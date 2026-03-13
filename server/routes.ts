import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { analyzeRequestSchema, contextRequestSchema, PROVIDERS, type AnalysisJob, type LLMConfig, type ProviderId } from "@shared/schema";
import { cloneRepo, cleanupRepo, analyzeFiles, getFileContent } from "./analyzer";
import { summarizeFiles, synthesizeWiki, selectContext } from "./pipeline";

// Store file contents in memory per job
const jobFileContents = new Map<string, Map<string, string>>();
// Store LLM configs per job (for context selection later)
const jobLLMConfigs = new Map<string, LLMConfig>();

function buildLLMConfig(apiKey: string, provider: ProviderId, fastModel?: string, strongModel?: string): LLMConfig {
  const p = PROVIDERS[provider];
  return {
    apiKey,
    provider,
    fastModel: fastModel || p.defaultFastModel,
    strongModel: strongModel || p.defaultStrongModel,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // List available providers and models
  app.get("/api/providers", (_req, res) => {
    res.json(PROVIDERS);
  });

  // Start analysis
  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const { repoUrl, branch, apiKey, provider, fastModel, strongModel } = parsed.data;
      const llmConfig = buildLLMConfig(apiKey, provider, fastModel, strongModel);

      // Normalize GitHub URL
      let normalizedUrl = repoUrl.trim();
      if (normalizedUrl.includes("github.com") && !normalizedUrl.endsWith(".git")) {
        normalizedUrl = normalizedUrl.replace(/\/$/, "") + ".git";
      }

      const jobId = randomUUID();
      const job: AnalysisJob = {
        id: jobId,
        status: "cloning",
        progress: 0,
        message: "Starting analysis...",
        repoUrl: normalizedUrl,
        provider,
        startedAt: Date.now(),
      };

      await storage.createJob(job);
      jobLLMConfigs.set(jobId, llmConfig);
      res.json({ jobId });

      // Run pipeline asynchronously
      runPipeline(jobId, normalizedUrl, branch, llmConfig).catch(err => {
        console.error("Pipeline error:", err);
        storage.updateJob(jobId, {
          status: "error",
          error: String(err.message || err),
          message: "Analysis failed",
        });
      });

    } catch (err: any) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Get job status
  app.get("/api/status/:jobId", async (req, res) => {
    const job = await storage.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      repoUrl: job.repoUrl,
      provider: job.provider,
      error: job.error,
      startedAt: job.startedAt,
    });
  });

  // Get wiki result
  app.get("/api/wiki/:jobId", async (req, res) => {
    const job = await storage.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.status !== "complete") {
      return res.status(400).json({ error: "Analysis not complete", status: job.status });
    }

    res.json({
      result: job.result,
      fileAnalysis: job.fileAnalysis,
      fileSummaries: job.fileSummaries,
      dependencyEdges: job.dependencyEdges,
    });
  });

  // Smart context selection
  app.post("/api/context/:jobId", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (job.status !== "complete" || !job.result) {
        return res.status(400).json({ error: "Analysis not complete" });
      }

      const parsed = contextRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      }

      // Build config from request, falling back to job's stored config
      const storedConfig = jobLLMConfigs.get(job.id);
      const llmConfig = buildLLMConfig(
        parsed.data.apiKey,
        parsed.data.provider,
        parsed.data.fastModel || storedConfig?.fastModel,
      );

      const fileContents = jobFileContents.get(job.id) || new Map();
      const result = await selectContext(
        llmConfig,
        parsed.data.task,
        job.result,
        job.fileSummaries || [],
        fileContents,
      );

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Context selection failed" });
    }
  });

  return httpServer;
}

async function runPipeline(
  jobId: string,
  repoUrl: string,
  branch: string | undefined,
  config: LLMConfig,
): Promise<void> {
  let repoDir: string | null = null;
  const providerName = PROVIDERS[config.provider].name;

  try {
    // === PASS 0: Clone ===
    await storage.updateJob(jobId, {
      status: "cloning",
      progress: 5,
      message: "Cloning repository...",
    });

    repoDir = await cloneRepo(repoUrl, branch);

    // === PASS 1: Static Analysis ===
    await storage.updateJob(jobId, {
      status: "analyzing",
      progress: 15,
      message: "Analyzing file structure and dependencies...",
    });

    const { files, edges } = analyzeFiles(repoDir);

    await storage.updateJob(jobId, {
      status: "analyzing",
      progress: 25,
      message: `Found ${files.length} files, built dependency graph with ${edges.length} edges`,
      fileAnalysis: files,
      dependencyEdges: edges,
    });

    // Read file contents for top files
    const fileContents = new Map<string, string>();
    const topFiles = files.slice(0, 30);
    for (const file of topFiles) {
      const content = getFileContent(repoDir, file.path, 200);
      if (content) fileContents.set(file.path, content);
    }

    jobFileContents.set(jobId, fileContents);

    // === PASS 2: File Summaries ===
    await storage.updateJob(jobId, {
      status: "summarizing",
      progress: 30,
      message: `Summarizing top ${topFiles.length} files via ${providerName} (${config.fastModel})...`,
    });

    const summaries = await summarizeFiles(
      config,
      files,
      fileContents,
      (completed, total) => {
        const pct = 30 + Math.round((completed / total) * 40);
        storage.updateJob(jobId, {
          progress: pct,
          message: `Summarized ${completed}/${total} files...`,
        });
      },
    );

    await storage.updateJob(jobId, {
      status: "summarizing",
      progress: 70,
      message: `Completed ${summaries.length} file summaries`,
      fileSummaries: summaries,
    });

    // === PASS 3: Architecture Synthesis ===
    await storage.updateJob(jobId, {
      status: "synthesizing",
      progress: 75,
      message: `Synthesizing architecture overview via ${providerName} (${config.strongModel})...`,
    });

    const repoName = repoUrl.split("/").slice(-2).join("/").replace(".git", "");
    const wiki = await synthesizeWiki(config, repoName, files, summaries, edges);

    await storage.updateJob(jobId, {
      status: "complete",
      progress: 100,
      message: "Analysis complete!",
      result: wiki,
    });

  } finally {
    if (repoDir) {
      cleanupRepo(repoDir);
    }
  }
}
