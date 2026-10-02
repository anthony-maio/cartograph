import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CloneCache } from "../../src/app/clone-cache.ts";

function fakeDeps(initialHead: string | null) {
  const state = { head: initialHead, now: 0, clones: 0, cleaned: [] as string[] };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-clone-cache-"));
  return {
    state,
    root,
    deps: {
      clone: async () => {
        state.clones++;
        const dir = path.join(root, `clone-${state.clones}`);
        fs.mkdirSync(dir);
        return dir;
      },
      cleanup: (dir: string) => {
        state.cleaned.push(dir);
        fs.rmSync(dir, { recursive: true, force: true });
      },
      remoteHead: async () => state.head,
      now: () => state.now,
    },
  };
}

test("CloneCache reuses a clone while the remote HEAD is unchanged", async () => {
  const { state, root, deps } = fakeDeps("abc");
  const cache = new CloneCache(60_000, deps);
  try {
    const first = await cache.acquire("https://github.com/o/r.git");
    first.release();
    const second = await cache.acquire("https://github.com/o/r.git");
    second.release();

    assert.equal(first.repoDir, second.repoDir);
    assert.equal(state.clones, 1);
  } finally {
    cache.clear();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CloneCache re-clones when the remote HEAD moves and cleans up the stale copy", async () => {
  const { state, root, deps } = fakeDeps("abc");
  const cache = new CloneCache(60_000, deps);
  try {
    const first = await cache.acquire("u");
    first.release();
    state.head = "def";
    const second = await cache.acquire("u");
    second.release();

    assert.notEqual(first.repoDir, second.repoDir);
    assert.equal(state.clones, 2);
    assert.deepEqual(state.cleaned, [first.repoDir]);
  } finally {
    cache.clear();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CloneCache never reuses a clone when the remote HEAD is unknown", async () => {
  const { state, root, deps } = fakeDeps(null);
  const cache = new CloneCache(60_000, deps);
  try {
    (await cache.acquire("u")).release();
    (await cache.acquire("u")).release();
    assert.equal(state.clones, 2);
  } finally {
    cache.clear();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CloneCache shares one clone between concurrent callers", async () => {
  const { state, root, deps } = fakeDeps("abc");
  const cache = new CloneCache(60_000, deps);
  try {
    const [a, b] = await Promise.all([cache.acquire("u"), cache.acquire("u")]);
    assert.equal(a.repoDir, b.repoDir);
    assert.equal(state.clones, 1);
    a.release();
    b.release();
  } finally {
    cache.clear();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CloneCache evicts expired entries but never one that is still leased", async () => {
  const { state, root, deps } = fakeDeps("abc");
  const cache = new CloneCache(1_000, deps);
  try {
    const leased = await cache.acquire("leased");
    (await cache.acquire("idle")).release();

    state.now = 5_000;
    (await cache.acquire("other")).release();

    assert.ok(fs.existsSync(leased.repoDir), "a leased clone must survive eviction");
    assert.equal(state.cleaned.length, 1, "only the idle clone should be evicted");
    leased.release();
  } finally {
    cache.clear();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
