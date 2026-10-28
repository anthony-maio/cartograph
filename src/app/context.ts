import { getFileContent } from "../analyzer";
import { buildTaskPacket, extractTaskTokens, findTaskAnchorPaths, findTaskMatchingPaths, matchesToken, type BuildTaskPacketOptions } from "./task-packets";

export interface SelectedContextFile {
  path: string;
  reason: string;
  content?: string;
}

export interface HydratedContextFile {
  path: string;
  reason: string;
  content: string;
  startLine?: number;
  endLine?: number;
  truncated?: boolean;
}

export function selectStaticContextFiles(
  opts: Omit<BuildTaskPacketOptions, "taskType">,
  top: number,
): SelectedContextFile[] {
  const packet = buildTaskPacket({ ...opts, taskType: "task" });
  const matches = findTaskMatchingPaths(opts.files, opts.taskSummary);
  const relevantPaths = new Set(matches);
  for (const edge of opts.edges) {
    if (matches.has(edge.from)) relevantPaths.add(edge.to);
    if (matches.has(edge.to)) relevantPaths.add(edge.from);
  }

  // Keep named source surfaces ahead of hub scores, then include validation and
  // supporting files. Never pad the result with unrelated files.
  const candidates: SelectedContextFile[] = [
    ...findTaskAnchorPaths(opts.files, opts.taskSummary).map((filePath) => ({
      path: filePath,
      reason: "Filename or exported symbol matches task terms",
    })),
    ...packet.validationTargets,
    ...packet.minimalContext,
    ...packet.keyFiles,
    ...opts.files.map((file) => ({
      path: file.path,
      reason: matches.has(file.path) ? "Matches task terms" : "Direct dependency or caller of a task-matched file",
    })),
  ];
  const selected: SelectedContextFile[] = [];
  const seen = new Set<string>();
  for (const file of candidates) {
    if (!relevantPaths.has(file.path) || seen.has(file.path)) continue;
    selected.push({ path: file.path, reason: file.reason });
    seen.add(file.path);
    if (selected.length >= top) break;
  }
  return selected;
}

export function hydrateContextFiles(
  repoDir: string,
  files: SelectedContextFile[],
  fileContents: Map<string, string>,
  maxLines: number = 200,
  taskSummary?: string,
): HydratedContextFile[] {
  const hydrated: HydratedContextFile[] = [];

  for (const file of files) {
    if (taskSummary !== undefined) {
      // Static selection needs the actual source to find matches below the
      // initial preview. The model-backed branch keeps its existing cache path.
      const source = getFileContent(repoDir, file.path, Number.MAX_SAFE_INTEGER);
      if (!source.trim()) continue;
      const excerpt = selectTaskExcerpt(source, taskSummary, Math.min(maxLines, 80));
      fileContents.set(file.path, excerpt.content);
      hydrated.push({ path: file.path, reason: file.reason, ...excerpt });
      continue;
    }
    const cachedContent = file.content?.trim()
      ? file.content
      : fileContents.get(file.path) || getFileContent(repoDir, file.path, maxLines);

    if (!cachedContent.trim()) {
      continue;
    }

    fileContents.set(file.path, cachedContent);
    hydrated.push({
      path: file.path,
      reason: file.reason,
      content: cachedContent,
    });
  }

  return hydrated;
}

function selectTaskExcerpt(source: string, taskSummary: string, maxLines: number) {
  const lines = source.split("\n");
  const tokens = extractTaskTokens(taskSummary);
  let bestLine = 0;
  let bestScore = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].toLowerCase();
    const score = tokens.filter((token) => matchesToken(line, token)).length;
    if (score > bestScore) {
      bestScore = score;
      bestLine = index;
    }
  }
  const end = Math.min(lines.length, Math.max(0, bestLine - Math.floor(maxLines / 2)) + maxLines);
  const start = Math.max(0, end - maxLines);
  let content = lines.slice(start, end).join("\n");
  if (end < lines.length && content.endsWith("\r")) content = content.slice(0, -1);
  return {
    content,
    startLine: start + 1,
    endLine: end,
    truncated: start > 0 || end < lines.length,
  };
}

export function estimateContextTokens(files: Array<{ content: string }>): number {
  return files.reduce((total, file) => total + Math.ceil(file.content.length / 4), 0);
}
