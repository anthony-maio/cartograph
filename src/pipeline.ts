/**
 * 3-pass analysis pipeline.
 * Provider-agnostic — uses the LLM client abstraction from llm.ts.
 */
import type { FileNode, FileSummary, ModuleDoc, ContextGuide, WikiResult, DependencyEdge, LLMConfig } from "./schema";
import { createLLMClient, type LLMClient } from "./llm";

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Pass 2: Summarize individual high-importance files
// ---------------------------------------------------------------------------
export async function summarizeFiles(
  config: LLMConfig,
  files: FileNode[],
  fileContents: Map<string, string>,
  onProgress: (completed: number, total: number) => void,
): Promise<FileSummary[]> {
  const client = createLLMClient(config);
  const summaries: FileSummary[] = [];
  const topFiles = files.slice(0, 30);
  const total = topFiles.length;

  // Batch size varies: Gemini has generous RPM, OpenAI/OpenRouter less so
  const batchSize = config.provider === "gemini" ? 5 : 3;

  for (let i = 0; i < topFiles.length; i += batchSize) {
    const batch = topFiles.slice(i, i + batchSize);
    const batchPromises = batch.map(async (file) => {
      const content = fileContents.get(file.path) || "";
      if (!content.trim()) return null;

      const prompt = `Analyze this source file and provide a concise summary. Be precise and technical.

FILE: ${file.path}
LANGUAGE: ${file.language}
IMPORTS: ${file.imports.slice(0, 15).join(", ") || "none"}
EXPORTS: ${file.exports.join(", ") || "none"}

CODE:
\`\`\`${file.language}
${content}
\`\`\`

Respond in this exact JSON format (no markdown wrapping, just the raw JSON object):
{
  "purpose": "1-2 sentence description of what this file does",
  "publicApi": "List of exported functions/classes/types with their signatures. Use actual code signatures where visible.",
  "dependencies": ["list", "of", "key", "external", "dependencies"],
  "architecturalRole": "One of: entry-point, router, controller, model, service, utility, config, middleware, component, hook, type-definitions, test, documentation"
}`;

      try {
        const text = await client.generate(config.fastModel, {
          prompt,
          json: true,
          temperature: 0.1,
        });

        const parsed = JSON.parse(text);
        return {
          path: file.path,
          purpose: parsed.purpose || "Unknown",
          publicApi: parsed.publicApi || "",
          dependencies: parsed.dependencies || [],
          architecturalRole: parsed.architecturalRole || "utility",
        } as FileSummary;
      } catch (err) {
        console.error(`Error summarizing ${file.path}:`, err);
        return {
          path: file.path,
          purpose: `${file.language} file with ${file.exports.length} exports`,
          publicApi: file.exports.join(", "),
          dependencies: file.imports.slice(0, 5),
          architecturalRole: "utility",
        } as FileSummary;
      }
    });

    const results = await Promise.all(batchPromises);
    for (const r of results) {
      if (r) summaries.push(r);
    }

    onProgress(Math.min(i + batchSize, total), total);

    if (i + batchSize < topFiles.length) {
      await delay(config.provider === "gemini" ? 800 : 1500);
    }
  }

  return summaries;
}

// ---------------------------------------------------------------------------
// Pass 3: Synthesize architecture overview from summaries
// ---------------------------------------------------------------------------
export async function synthesizeWiki(
  config: LLMConfig,
  repoName: string,
  files: FileNode[],
  summaries: FileSummary[],
  edges: DependencyEdge[],
): Promise<WikiResult> {
  const client = createLLMClient(config);

  const fileTree = files.slice(0, 50).map(f =>
    `${f.path} (${f.language}, ${f.lines}L, importance: ${f.importanceScore})`
  ).join("\n");

  const summaryText = summaries.map(s =>
    `## ${s.path}\nRole: ${s.architecturalRole}\nPurpose: ${s.purpose}\nAPI: ${s.publicApi}\nDeps: ${s.dependencies.join(", ")}`
  ).join("\n\n");

  const depText = edges.slice(0, 100).map(e => `${e.from} → ${e.to}`).join("\n");

  const prompt = `You are an expert software architect. Analyze this repository and produce comprehensive documentation.

REPOSITORY: ${repoName}
TOTAL FILES: ${files.length}
ANALYZED FILES: ${summaries.length}

FILE TREE (top 50 by importance):
${fileTree}

FILE SUMMARIES:
${summaryText}

DEPENDENCY GRAPH (top 100 edges):
${depText}

Produce a JSON response with this exact structure (no markdown wrapping, just the raw JSON object):
{
  "overview": "3-5 paragraph overview of what this project is, what it does, and who it's for. Write in markdown.",
  "architecture": "Detailed architecture description in markdown. Describe the layers, how data flows, key abstractions, and the module structure. Use headers (##) for sections.",
  "patterns": "Key patterns, design decisions, and idioms used in this codebase. Note any frameworks, conventions, or architectural choices. Write in markdown.",
  "modules": [
    {
      "name": "Module/directory name",
      "description": "What this module is responsible for",
      "files": ["list of file paths in this module"]
    }
  ],
  "contextGuide": [
    {
      "taskType": "Description of a common task (e.g., 'Add a new API endpoint', 'Fix a frontend bug')",
      "relevantFiles": ["file1.ts", "file2.ts"],
      "explanation": "Why these files matter for this task and what to look for in each"
    }
  ]
}

For the modules array, group related files logically (by directory or by function).
For the contextGuide, provide 5-8 common development tasks and the minimal set of files an AI would need to understand to complete each task.

IMPORTANT: The contextGuide is the most valuable part. Think about what an AI coding assistant would actually need. Not the whole codebase — just the relevant files with their function signatures.`;

  try {
    const text = await client.generate(config.strongModel, {
      prompt,
      json: true,
      temperature: 0.3,
    });

    const parsed = JSON.parse(text);

    const modules: ModuleDoc[] = (parsed.modules || []).map((m: any) => ({
      name: m.name,
      description: m.description,
      files: (m.files || []).map((fp: string) => {
        const summary = summaries.find(s => s.path === fp);
        return summary || {
          path: fp,
          purpose: "",
          publicApi: "",
          dependencies: [],
          architecturalRole: "utility",
        };
      }),
    }));

    const totalCodeTokens = files.reduce((acc, f) => acc + Math.ceil(f.bytes / 4), 0);
    const wikiTokens = Math.ceil(text.length / 4);
    const tokensSaved = Math.max(0, totalCodeTokens - wikiTokens);

    return {
      repoName,
      overview: parsed.overview || "No overview generated.",
      architecture: parsed.architecture || "No architecture description generated.",
      patterns: parsed.patterns || "No patterns identified.",
      modules,
      contextGuide: (parsed.contextGuide || []) as ContextGuide[],
      totalFiles: files.length,
      analyzedFiles: summaries.length,
      totalTokensSaved: tokensSaved,
    };
  } catch (err) {
    console.error("Error in synthesis:", err);
    throw new Error(`Synthesis failed: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Context selection: Given a task, pick the minimal relevant files
// ---------------------------------------------------------------------------
export async function selectContext(
  config: LLMConfig,
  task: string,
  wiki: WikiResult,
  summaries: FileSummary[],
  fileContents: Map<string, string>,
): Promise<{ files: Array<{ path: string; reason: string; content: string }>; totalTokens: number }> {
  const client = createLLMClient(config);

  const summaryText = summaries.map(s =>
    `${s.path} | ${s.architecturalRole} | ${s.purpose}`
  ).join("\n");

  const guideText = wiki.contextGuide.map(g =>
    `Task: ${g.taskType}\nFiles: ${g.relevantFiles.join(", ")}`
  ).join("\n\n");

  const prompt = `You are a context engineer. Given a development task and a codebase summary, select the MINIMAL set of files an AI coding assistant needs to complete the task effectively.

TASK: ${task}

ARCHITECTURE:
${wiki.architecture.slice(0, 2000)}

FILE SUMMARIES:
${summaryText}

EXISTING CONTEXT GUIDES:
${guideText}

Select 3-10 files. For each file, explain WHY it's needed. Prefer:
- Files directly modified by the task
- Files that define interfaces/types used by modified files
- Entry points and routers that wire things together
- Configuration that constrains the solution

DO NOT include:
- Test files (unless the task is about testing)
- Documentation files
- Files that are only tangentially related

Respond in JSON (no markdown wrapping, just the raw JSON object):
{
  "files": [
    { "path": "exact/file/path.ts", "reason": "Why this file is needed for the task" }
  ]
}`;

  try {
    const text = await client.generate(config.fastModel, {
      prompt,
      json: true,
      temperature: 0.1,
    });

    const parsed = JSON.parse(text);

    const selectedFiles = (parsed.files || []).map((f: any) => {
      const content = fileContents.get(f.path) || "";
      return {
        path: f.path,
        reason: f.reason,
        content,
      };
    }).filter((f: any) => f.content);

    const totalTokens = selectedFiles.reduce(
      (acc: number, f: any) => acc + Math.ceil(f.content.length / 4), 0
    );

    return { files: selectedFiles, totalTokens };
  } catch (err) {
    console.error("Error in context selection:", err);
    throw new Error(`Context selection failed: ${err}`);
  }
}
