import * as fs from "node:fs";
import simpleGit from "simple-git";
import { cleanupRepo, cloneRepo } from "../analyzer";

export interface CloneCacheDeps {
  clone: (url: string) => Promise<string>;
  cleanup: (dir: string) => void;
  // Current commit of the remote's default branch, or null when it cannot be determined
  remoteHead: (url: string) => Promise<string | null>;
  now: () => number;
}

interface CloneEntry {
  dir: string;
  sha: string | null;
  expiresAt: number;
  refs: number;
}

export interface CloneLease {
  repoDir: string;
  release: () => void;
}

/**
 * Keeps remote clones around between MCP tool calls so `analyze_repo` followed by
 * `get_file_contents` reads one checkout instead of cloning twice. An entry is
 * reused only while the remote HEAD still matches the commit that was cloned.
 */
export class CloneCache {
  private readonly entries = new Map<string, CloneEntry>();
  private readonly pending = new Map<string, Promise<CloneEntry>>();
  private readonly deps: CloneCacheDeps;

  constructor(private readonly ttlMs = 10 * 60_000, deps: Partial<CloneCacheDeps> = {}) {
    this.deps = {
      clone: deps.clone ?? cloneRepo,
      cleanup: deps.cleanup ?? cleanupRepo,
      remoteHead: deps.remoteHead ?? getRemoteHead,
      now: deps.now ?? Date.now,
    };
  }

  async acquire(url: string): Promise<CloneLease> {
    this.evictExpired();

    const inFlight = this.pending.get(url);
    const entry = inFlight ? await inFlight : await this.lookupOrClone(url);

    entry.refs++;
    entry.expiresAt = this.deps.now() + this.ttlMs;
    let released = false;
    return {
      repoDir: entry.dir,
      release: () => {
        if (released) return;
        released = true;
        entry.refs--;
        if (this.entries.get(url) !== entry && entry.refs === 0) {
          this.deps.cleanup(entry.dir); // replaced while leased
        }
      },
    };
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      this.deps.cleanup(entry.dir);
    }
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  private async lookupOrClone(url: string): Promise<CloneEntry> {
    const promise = (async () => {
      const sha = await this.deps.remoteHead(url).catch(() => null);
      const existing = this.entries.get(url);
      if (existing && sha && existing.sha === sha && fs.existsSync(existing.dir)) {
        return existing;
      }

      const dir = await this.deps.clone(url);
      const fresh: CloneEntry = { dir, sha, expiresAt: 0, refs: 0 };
      this.entries.set(url, fresh);
      if (existing && existing.refs === 0) {
        this.deps.cleanup(existing.dir);
      }
      return fresh;
    })();

    this.pending.set(url, promise);
    try {
      return await promise;
    } finally {
      this.pending.delete(url);
    }
  }

  private evictExpired(): void {
    const now = this.deps.now();
    for (const [url, entry] of this.entries) {
      if (entry.refs === 0 && entry.expiresAt <= now) {
        this.deps.cleanup(entry.dir);
        this.entries.delete(url);
      }
    }
  }
}

async function getRemoteHead(url: string): Promise<string | null> {
  const output = await simpleGit().listRemote([url, "HEAD"]);
  return output.split(/\s+/)[0] || null;
}
