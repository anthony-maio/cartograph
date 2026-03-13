import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  createRunWorkspace,
  getCacheRoot,
  getRepoFingerprint,
  loadRunManifest,
} from "../../src/app/cache.ts";

test("getCacheRoot prefers CARTOGRAPH_CACHE_DIR and falls back to the user cache", () => {
  assert.equal(
    getCacheRoot({ CARTOGRAPH_CACHE_DIR: "/tmp/cartograph-cache" }),
    path.resolve("/tmp/cartograph-cache"),
  );

  assert.equal(
    getCacheRoot({}),
    path.join(os.homedir(), ".cartograph", "cache"),
  );
});

test("getRepoFingerprint is stable for the same repo id", () => {
  const first = getRepoFingerprint("https://github.com/example/repo");
  const second = getRepoFingerprint("https://github.com/example/repo");
  const third = getRepoFingerprint("https://github.com/example/other");

  assert.equal(first, second);
  assert.notEqual(first, third);
});

test("createRunWorkspace creates the run directory and manifest", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-cache-test-"));

  try {
    const workspace = createRunWorkspace({
      repo: "https://github.com/example/repo",
      command: "analyze",
      cacheRoot: tempRoot,
      runId: "run-test-1",
      createdAt: "2026-03-13T00:00:00.000Z",
    });

    assert.equal(path.basename(workspace.runDir), "run-test-1");
    assert.ok(fs.existsSync(workspace.runDir));
    assert.ok(fs.existsSync(workspace.manifestPath));

    const manifest = loadRunManifest(workspace.runDir);
    assert.equal(manifest.runId, "run-test-1");
    assert.equal(manifest.command, "analyze");
    assert.equal(manifest.repo, "https://github.com/example/repo");
    assert.deepEqual(manifest.artifacts, {});
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
