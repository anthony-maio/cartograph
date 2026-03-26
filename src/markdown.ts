import type { WikiResult, FileSummary, FileNode, DependencyEdge } from "./schema";
import type { TaskPacket } from "./app/task-packets";

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

export function staticToMarkdown(
  repoName: string,
  files: FileNode[],
  edges: DependencyEdge[],
  fileContents: Map<string, string>,
): string {
  const lines: string[] = [];
  const totalTokens = Array.from(fileContents.values()).reduce((acc, c) => acc + Math.ceil(c.length / 4), 0);

  lines.push(`# ${repoName}`);
  lines.push("");
  lines.push(`> ${files.length} files analyzed, ${edges.length} dependency edges, ~${totalTokens.toLocaleString()} tokens of context below`);
  lines.push("");

  // Language breakdown
  const langCounts: Record<string, number> = {};
  for (const f of files) {
    langCounts[f.language] = (langCounts[f.language] || 0) + 1;
  }
  lines.push("## Languages");
  lines.push("");
  for (const [lang, count] of Object.entries(langCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${lang}: ${count} files`);
  }
  lines.push("");

  // Scored file list
  lines.push("## Files by Importance");
  lines.push("");
  lines.push("| Score | File | Language | Lines | Exports |");
  lines.push("|-------|------|----------|-------|---------|");
  for (const f of files.slice(0, 50)) {
    lines.push(`| ${f.importanceScore} | \`${f.path}\` | ${f.language} | ${f.lines} | ${f.exports.length} |`);
  }
  lines.push("");

  // Key dependency edges
  if (edges.length > 0) {
    lines.push("## Key Dependencies");
    lines.push("");
    for (const e of edges.slice(0, 50)) {
      lines.push(`- \`${e.from}\` → \`${e.to}\``);
    }
    lines.push("");
  }

  // File contents
  lines.push("## File Contents");
  lines.push("");
  for (const [filePath, content] of fileContents) {
    const file = files.find(f => f.path === filePath);
    const ext = filePath.split(".").pop() || "";
    lines.push(`### ${filePath}`);
    lines.push("");
    if (file) {
      lines.push(`Score: ${file.importanceScore} | ${file.language} | ${file.lines} lines | Exports: ${file.exports.join(", ") || "none"}`);
      lines.push("");
    }
    lines.push("```" + ext);
    lines.push(content);
    lines.push("```");
    lines.push("");
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

export function taskPacketToMarkdown(packet: TaskPacket): string {
  const lines: string[] = [];

  lines.push(`# ${packet.taskType}: ${packet.taskSummary}`);
  lines.push("");
  lines.push(`> Repo: ${packet.repoName} | Confidence: ${packet.confidence}`);
  lines.push("");

  lines.push("## Key Files");
  lines.push("");
  for (const file of packet.keyFiles) {
    lines.push(`- \`${file.path}\` — ${file.reason}`);
  }
  lines.push("");

  lines.push("## Dependency Hubs");
  lines.push("");
  for (const hub of packet.dependencyHubs) {
    lines.push(`- \`${hub.path}\` — ${hub.role} (${hub.inboundCount} inbound, ${hub.outboundCount} outbound)`);
  }
  lines.push("");

  if (packet.entryPoints.length > 0) {
    lines.push("## Entry Points");
    lines.push("");
    for (const entry of packet.entryPoints) {
      lines.push(`- \`${entry}\``);
    }
    lines.push("");
  }

  lines.push("## Minimal Context");
  lines.push("");
  for (const file of packet.minimalContext) {
    lines.push(`- \`${file.path}\` — ${file.reason}`);
  }
  lines.push("");

  if (packet.validationTargets.length > 0) {
    lines.push("## Validation Targets");
    lines.push("");
    for (const target of packet.validationTargets) {
      lines.push(`- \`${target.path}\` — ${target.reason}`);
    }
    lines.push("");
  }

  if (packet.risks.length > 0) {
    lines.push("## Risks");
    lines.push("");
    for (const risk of packet.risks) {
      lines.push(`- ${risk}`);
    }
    lines.push("");
  }

  if (packet.unknowns.length > 0) {
    lines.push("## Unknowns");
    lines.push("");
    for (const unknown of packet.unknowns) {
      lines.push(`- ${unknown}`);
    }
    lines.push("");
  }

  lines.push("## Recommended Next Steps");
  lines.push("");
  for (const step of packet.recommendedNextSteps) {
    lines.push(`- ${step}`);
  }
  lines.push("");

  lines.push("## Details");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(packet.details, null, 2));
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}
