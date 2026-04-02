import type { FileNode } from "../schema";

export const SMALL_REPO_COMPACT_THRESHOLD = 20;

export interface AnalysisContentPolicy {
  mode: "full" | "compact" | "summary";
  includeContents: boolean;
  omittedFileContents: boolean;
  reason: string;
  repoFileCount: number;
  threshold: number;
}

export function resolveAnalysisContentPolicy(
  files: FileNode[],
  includeContentsRequested = false,
  surface: "json" | "markdown" = "json",
): AnalysisContentPolicy {
  if (includeContentsRequested) {
    return {
      mode: "full",
      includeContents: true,
      omittedFileContents: false,
      reason: "Embedded file contents were explicitly requested.",
      repoFileCount: files.length,
      threshold: SMALL_REPO_COMPACT_THRESHOLD,
    };
  }

  if (surface === "markdown") {
    return {
      mode: "summary",
      includeContents: false,
      omittedFileContents: true,
      reason: "Markdown analyze output is summary-first by default. Use --include-contents when you want embedded snippets.",
      repoFileCount: files.length,
      threshold: SMALL_REPO_COMPACT_THRESHOLD,
    };
  }

  if (files.length <= SMALL_REPO_COMPACT_THRESHOLD) {
    return {
      mode: "compact",
      includeContents: false,
      omittedFileContents: true,
      reason: "Small repos are usually faster to inspect directly. Use --include-contents or get_file_contents when you need embedded snippets.",
      repoFileCount: files.length,
      threshold: SMALL_REPO_COMPACT_THRESHOLD,
    };
  }

  return {
    mode: "full",
    includeContents: true,
    omittedFileContents: false,
    reason: "Embedded top-file contents are included by default for larger repos.",
    repoFileCount: files.length,
    threshold: SMALL_REPO_COMPACT_THRESHOLD,
  };
}
