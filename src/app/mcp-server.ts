import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { analyzeFiles, cleanupRepo, cloneRepo, getFileContent } from "../analyzer";
import { buildTaskPacket, type TaskPacketType } from "./task-packets";
import { resolveAnalysisContentPolicy } from "./analysis-output";

const TASK_PACKET_TYPES = ["task", "bug-fix", "pr-review", "trace-flow", "change-request"] as const;

interface ResolvedRepoInput {
  repoDir: string;
  repoId: string;
  repoName: string;
  needsCleanup: boolean;
}

export function createCartographMcpServer(): McpServer {
  const server = new McpServer({
    name: "cartograph",
    version: "1.1.4",
  });

  server.tool(
    "analyze_repo",
    "Analyze a codebase: score files by importance, map dependencies, return top file contents. Works on local paths or GitHub URLs.",
    {
      repo: z.string().describe("GitHub URL or absolute local directory path"),
      top: z.number().optional().default(30).describe("Number of top files to include contents for (default 30)"),
      max_lines: z.number().optional().default(200).describe("Max lines per file (default 200)"),
      include_contents: z.boolean().optional().default(false).describe("Force embedding top file contents even for compact small-repo mode"),
    },
    async ({ repo, top, max_lines, include_contents }) =>
      withResolvedRepo(repo, async ({ repoDir, repoName }) => {
        const { files, edges } = analyzeFiles(repoDir);

        const topFiles = files.slice(0, top);
        const contentPolicy = resolveAnalysisContentPolicy(files, include_contents);
        const fileContents: Record<string, string> = {};
        if (contentPolicy.includeContents) {
          for (const file of topFiles) {
            const content = getFileContent(repoDir, file.path, max_lines);
            if (content) {
              fileContents[file.path] = content;
            }
          }
        }

        const langCounts: Record<string, number> = {};
        for (const file of files) {
          langCounts[file.language] = (langCounts[file.language] || 0) + 1;
        }

        const result = {
          repoName,
          totalFiles: files.length,
          totalEdges: edges.length,
          languages: langCounts,
          files: files.slice(0, 50).map((file) => ({
            path: file.path,
            language: file.language,
            lines: file.lines,
            importanceScore: file.importanceScore,
            exports: file.exports,
            imports: file.imports,
          })),
          dependencies: edges.slice(0, 50).map((edge) => `${edge.from} → ${edge.to}`),
          fileContents,
          contentPolicy,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }),
  );

  server.tool(
    "get_file_contents",
    "Read specific files from a repo with full content. Use after analyze_repo to drill into files of interest.",
    {
      repo: z.string().describe("GitHub URL or absolute local directory path"),
      files: z.array(z.string()).describe("List of file paths (relative to repo root) to read"),
      max_lines: z.number().optional().default(500).describe("Max lines per file (default 500)"),
    },
    async ({ repo, files: filePaths, max_lines }) =>
      withResolvedRepo(repo, async ({ repoDir }) => {
        const results: Record<string, string> = {};
        for (const filePath of filePaths) {
          const content = getFileContent(repoDir, filePath, max_lines);
          results[filePath] = content || "[file not found or empty]";
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
        };
      }),
  );

  server.tool(
    "build_task_packet",
    "Build a typed task packet for a local repo or GitHub URL. Returns key files, dependency hubs, minimal context, risks, validation targets, and task-specific details.",
    {
      repo: z.string().describe("GitHub URL or absolute local directory path"),
      type: z.enum(TASK_PACKET_TYPES).describe("Packet type: task, bug-fix, pr-review, trace-flow, or change-request"),
      task: z.string().min(1).describe("Concrete task summary to optimize the packet for"),
      changed_files: z.array(z.string()).optional().describe("Optional changed files relative to the repo root"),
    },
    async ({ repo, type, task, changed_files }) =>
      withResolvedRepo(repo, async ({ repoDir, repoId, repoName }) => {
        const { files, edges } = analyzeFiles(repoDir);
        const packet = buildTaskPacket({
          repoId,
          repoName,
          taskType: type as TaskPacketType,
          taskSummary: task,
          files,
          edges,
          changedFiles: changed_files,
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(packet, null, 2) }],
          structuredContent: packet as unknown as Record<string, unknown>,
        };
      }),
  );

  return server;
}

async function withResolvedRepo<T>(repo: string, callback: (resolved: ResolvedRepoInput) => Promise<T>): Promise<T> {
  const resolved = await resolveRepoInput(repo);
  try {
    return await callback(resolved);
  } finally {
    if (resolved.needsCleanup) {
      cleanupRepo(resolved.repoDir);
    }
  }
}

async function resolveRepoInput(repo: string): Promise<ResolvedRepoInput> {
  const isLocal = fs.existsSync(repo);
  if (isLocal) {
    const repoDir = path.resolve(repo);
    return {
      repoDir,
      repoId: repoDir,
      repoName: path.basename(repoDir),
      needsCleanup: false,
    };
  }

  const normalizedRepo = normalizeRemoteRepo(repo);
  return {
    repoDir: await cloneRepo(normalizedRepo),
    repoId: normalizedRepo,
    repoName: getRemoteRepoName(normalizedRepo),
    needsCleanup: true,
  };
}

function normalizeRemoteRepo(repo: string): string {
  const trimmed = repo.trim();
  if (trimmed.includes("github.com") && !trimmed.endsWith(".git")) {
    return trimmed.replace(/\/$/, "") + ".git";
  }
  return trimmed;
}

function getRemoteRepoName(repo: string): string {
  return repo
    .replace(/\/$/, "")
    .replace(/\.git$/, "")
    .split("/")
    .slice(-2)
    .join("/");
}
