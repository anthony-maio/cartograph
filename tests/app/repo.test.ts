import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getRemoteRepoName, normalizeRemoteRepo, resolveRepo } from "../../src/app/repo.ts";

test("normalizeRemoteRepo adds .git to GitHub URLs and trims trailing slashes", () => {
  assert.equal(normalizeRemoteRepo(" https://github.com/o/r/ "), "https://github.com/o/r.git");
  assert.equal(normalizeRemoteRepo("https://github.com/o/r.git"), "https://github.com/o/r.git");
  assert.equal(normalizeRemoteRepo("https://gitlab.com/o/r"), "https://gitlab.com/o/r");
});

test("getRemoteRepoName returns owner/name for https and ssh remotes", () => {
  assert.equal(getRemoteRepoName("https://github.com/o/r.git"), "o/r");
  assert.equal(getRemoteRepoName("git@github.com:o/r.git"), "o/r");
  assert.equal(getRemoteRepoName("https://github.com/o/r.github.io"), "o/r.github.io");
});

test("resolveRepo uses local directories in place and never cleans them up", async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-local-"));
  try {
    const resolved = await resolveRepo(repoDir, {
      clone: async () => assert.fail("local repos must not be cloned"),
    });
    assert.equal(resolved.isRemote, false);
    assert.equal(resolved.repoDir, path.resolve(repoDir));
    resolved.cleanup();
    assert.ok(fs.existsSync(repoDir));
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

test("resolveRepo clones remotes with the normalized URL", async () => {
  let clonedUrl = "";
  const resolved = await resolveRepo("https://github.com/o/r", {
    clone: async (url) => {
      clonedUrl = url;
      return path.join(os.tmpdir(), "does-not-matter");
    },
  });

  assert.equal(clonedUrl, "https://github.com/o/r.git");
  assert.equal(resolved.repoName, "o/r");
  assert.equal(resolved.isRemote, true);
});
