import { getFileContent } from "../analyzer";

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
