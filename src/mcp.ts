/**
 * Cartograph MCP Server
 *
 * Exposes codebase analysis as MCP tools that AI agents can call directly.
 * The agent IS the LLM, so only static analysis is needed — no external API keys.
 *
 * Tools:
 *  - analyze_repo: Full static analysis (scored files, dependency graph, top file contents)
 *  - get_file_contents: Read specific files from a repo with importance context
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { cloneRepo, cleanupRepo, analyzeFiles, getFileContent } from "./analyzer";

const server = new McpServer({
  name: "cartograph",
  version: "1.0.1",
});

server.tool(
  "analyze_repo",
  "Analyze a codebase: score files by importance, map dependencies, return top file contents. Works on local paths or GitHub URLs.",
  {
    repo: z.string().describe("GitHub URL or absolute local directory path"),
    top: z.number().optional().default(30).describe("Number of top files to include contents for (default 30)"),
    max_lines: z.number().optional().default(200).describe("Max lines per file (default 200)"),
  },
  async ({ repo, top, max_lines }) => {
    const isLocal = fs.existsSync(repo);
    let repoDir: string;
    let needsCleanup = false;

    try {
      if (isLocal) {
        repoDir = path.resolve(repo);
      } else {
        let url = repo.trim();
        if (url.includes("github.com") && !url.endsWith(".git")) {
          url = url.replace(/\/$/, "") + ".git";
        }
        repoDir = await cloneRepo(url);
        needsCleanup = true;
      }

      const { files, edges } = analyzeFiles(repoDir);

      const repoName = isLocal
        ? path.basename(path.resolve(repo))
        : repo.split("/").slice(-2).join("/").replace(".git", "").replace(/\/$/, "");

      // Read contents for top files
      const topFiles = files.slice(0, top);
      const fileContents: Record<string, string> = {};
      for (const file of topFiles) {
        const content = getFileContent(repoDir, file.path, max_lines);
        if (content) fileContents[file.path] = content;
      }

      // Language breakdown
      const langCounts: Record<string, number> = {};
      for (const f of files) {
        langCounts[f.language] = (langCounts[f.language] || 0) + 1;
      }

      const result = {
        repoName,
        totalFiles: files.length,
        totalEdges: edges.length,
        languages: langCounts,
        files: files.slice(0, 50).map(f => ({
          path: f.path,
          language: f.language,
          lines: f.lines,
          importanceScore: f.importanceScore,
          exports: f.exports,
          imports: f.imports,
        })),
        dependencies: edges.slice(0, 50).map(e => `${e.from} → ${e.to}`),
        fileContents,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } finally {
      if (needsCleanup && repoDir!) {
        cleanupRepo(repoDir!);
      }
    }
  },
);

server.tool(
  "get_file_contents",
  "Read specific files from a repo with full content. Use after analyze_repo to drill into files of interest.",
  {
    repo: z.string().describe("GitHub URL or absolute local directory path"),
    files: z.array(z.string()).describe("List of file paths (relative to repo root) to read"),
    max_lines: z.number().optional().default(500).describe("Max lines per file (default 500)"),
  },
  async ({ repo, files: filePaths, max_lines }) => {
    const isLocal = fs.existsSync(repo);
    let repoDir: string;
    let needsCleanup = false;

    try {
      if (isLocal) {
        repoDir = path.resolve(repo);
      } else {
        let url = repo.trim();
        if (url.includes("github.com") && !url.endsWith(".git")) {
          url = url.replace(/\/$/, "") + ".git";
        }
        repoDir = await cloneRepo(url);
        needsCleanup = true;
      }

      const results: Record<string, string> = {};
      for (const fp of filePaths) {
        const content = getFileContent(repoDir, fp, max_lines);
        if (content) {
          results[fp] = content;
        } else {
          results[fp] = "[file not found or empty]";
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    } finally {
      if (needsCleanup && repoDir!) {
        cleanupRepo(repoDir!);
      }
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Cartograph MCP server failed to start:", err);
  process.exit(1);
});
