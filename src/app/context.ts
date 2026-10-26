import { getFileContent } from "../analyzer";
import { buildTaskPacket, findTaskMatchingPaths, type BuildTaskPacketOptions } from "./task-packets";

export interface SelectedContextFile {
  path: string;
  reason: string;
  content?: string;
}

export interface HydratedContextFile {
  path: string;
  reason: string;
  content: string;
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

  // Keep the packet's ranking and tests, then add immediate dependencies that
  // did not fit its small minimal-context list. Never pad with unrelated files.
  const candidates: SelectedContextFile[] = [
    ...packet.minimalContext,
    ...packet.validationTargets,
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
): HydratedContextFile[] {
  const hydrated: HydratedContextFile[] = [];

  for (const file of files) {
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

export function estimateContextTokens(files: Array<{ content: string }>): number {
  return files.reduce((total, file) => total + Math.ceil(file.content.length / 4), 0);
}
