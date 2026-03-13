import type { WikiResult, FileSummary } from "./schema";

export function wikiToMarkdown(wiki: WikiResult): string {
  const lines: string[] = [];

  lines.push(`# ${wiki.repoName}`);
  lines.push("");
  lines.push(`> Analyzed ${wiki.analyzedFiles}/${wiki.totalFiles} files, ~${Math.round(wiki.totalTokensSaved / 1000)}K tokens saved vs full dump`);
  lines.push("");

  lines.push("## Overview");
  lines.push("");
  lines.push(wiki.overview);
  lines.push("");

  lines.push("## Architecture");
  lines.push("");
  lines.push(wiki.architecture);
  lines.push("");

  lines.push("## Patterns & Conventions");
  lines.push("");
  lines.push(wiki.patterns);
  lines.push("");

  if (wiki.modules.length > 0) {
    lines.push("## Modules");
    lines.push("");
    for (const mod of wiki.modules) {
      lines.push(`### ${mod.name}`);
      lines.push("");
      lines.push(mod.description);
      lines.push("");
      for (const file of mod.files) {
        lines.push(`- \`${file.path}\` — ${file.architecturalRole} — ${file.purpose}`);
      }
      lines.push("");
    }
  }

  if (wiki.contextGuide.length > 0) {
    lines.push("## Context Guides");
    lines.push("");
    for (const guide of wiki.contextGuide) {
      lines.push(`### ${guide.taskType}`);
      lines.push("");
      lines.push(`**Files:** ${guide.relevantFiles.map(f => `\`${f}\``).join(", ")}`);
      lines.push("");
      lines.push(guide.explanation);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function contextToMarkdown(
  task: string,
  files: Array<{ path: string; reason: string; content: string }>,
  totalTokens: number,
): string {
  const lines: string[] = [];

  lines.push(`# Context for: ${task}`);
  lines.push("");
  lines.push(`> ${files.length} files, ~${totalTokens.toLocaleString()} tokens`);
  lines.push("");

  for (const file of files) {
    const ext = file.path.split(".").pop() || "";
    lines.push(`## ${file.path}`);
    lines.push("");
    lines.push(`**Reason:** ${file.reason}`);
    lines.push("");
    lines.push("```" + ext);
    lines.push(file.content);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}
