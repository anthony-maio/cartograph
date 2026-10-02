import * as fs from "node:fs";
import * as path from "node:path";
import { cleanupRepo, cloneRepo } from "../analyzer";

export interface ResolvedRepo {
  repoDir: string;
  repoId: string;
  repoName: string;
  isRemote: boolean;
  cleanup: () => void;
}

export interface ResolveRepoOptions {
  clone?: (url: string) => Promise<string>;
}

export async function resolveRepo(repo: string, opts: ResolveRepoOptions = {}): Promise<ResolvedRepo> {
  if (fs.existsSync(repo)) {
    const repoDir = path.resolve(repo);
    return {
      repoDir,
      repoId: repoDir,
      repoName: path.basename(repoDir),
      isRemote: false,
      cleanup: () => {},
    };
  }

  const url = normalizeRemoteRepo(repo);
  const repoDir = await (opts.clone ?? cloneRepo)(url);
  return {
    repoDir,
    repoId: url,
    repoName: getRemoteRepoName(url),
    isRemote: true,
    cleanup: () => cleanupRepo(repoDir),
  };
}

export function normalizeRemoteRepo(repo: string): string {
  const trimmed = repo.trim().replace(/\/+$/, "");
  if (trimmed.includes("github.com") && !trimmed.endsWith(".git")) {
    return `${trimmed}.git`;
  }
  return trimmed;
}

export function getRemoteRepoName(repo: string): string {
  return repo
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .split(/[/:]/)
    .slice(-2)
    .join("/");
}
