import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface RunArtifactRecord {
  fileName: string;
  relativePath: string;
  format: string;
}

export interface RunManifest {
  runId: string;
  repo: string;
  repoFingerprint: string;
  command: string;
  createdAt: string;
  artifacts: Record<string, RunArtifactRecord>;
}

export interface RunWorkspace {
  runId: string;
  repoFingerprint: string;
  runDir: string;
  manifestPath: string;
}

export interface CreateRunWorkspaceOptions {
  repo: string;
  command: string;
  cacheRoot?: string;
  runId?: string;
  createdAt?: string;
  env?: NodeJS.ProcessEnv;
}

export function getCacheRoot(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.CARTOGRAPH_CACHE_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }

  return path.join(os.homedir(), ".cartograph", "cache");
}

export function getRepoFingerprint(repo: string): string {
  const normalized = repo.trim().replace(/\\/g, "/").toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

export function createRunWorkspace(opts: CreateRunWorkspaceOptions): RunWorkspace {
  const cacheRoot = path.resolve(opts.cacheRoot ?? getCacheRoot(opts.env));
  const repoFingerprint = getRepoFingerprint(opts.repo);
  const runId = opts.runId ?? createRunId();
  const runDir = path.join(cacheRoot, repoFingerprint, runId);
  const manifestPath = path.join(runDir, "manifest.json");

  fs.mkdirSync(path.join(runDir, "artifacts"), { recursive: true });

  const manifest: RunManifest = {
    runId,
    repo: opts.repo,
    repoFingerprint,
    command: opts.command,
    createdAt: opts.createdAt ?? new Date().toISOString(),
    artifacts: {},
  };

  writeManifest(manifestPath, manifest);

  return {
    runId,
    repoFingerprint,
    runDir,
    manifestPath,
  };
}

export function loadRunManifest(runDir: string): RunManifest {
  const manifestPath = path.join(runDir, "manifest.json");
  const raw = fs.readFileSync(manifestPath, "utf-8");
  return JSON.parse(raw) as RunManifest;
}

export function findRunDirectory(runId: string, cacheRoot: string = getCacheRoot()): string | null {
  const resolvedCacheRoot = path.resolve(cacheRoot);
  if (!fs.existsSync(resolvedCacheRoot)) {
    return null;
  }

  for (const entry of fs.readdirSync(resolvedCacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const runDir = path.join(resolvedCacheRoot, entry.name, runId);
    if (fs.existsSync(path.join(runDir, "manifest.json"))) {
      return runDir;
    }
  }

  return null;
}

export function saveRunManifest(runDir: string, manifest: RunManifest): void {
  const manifestPath = path.join(runDir, "manifest.json");
  writeManifest(manifestPath, manifest);
}

function createRunId(): string {
  return `run-${Date.now().toString(36)}`;
}

function writeManifest(manifestPath: string, manifest: RunManifest): void {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}
