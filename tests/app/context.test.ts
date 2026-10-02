import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { hydrateContextFiles } from "../../src/app/context.ts";

test("hydrateContextFiles loads selected files that were not part of the initial top-N content map", () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-context-"));

  try {
    const srcDir = path.join(repoDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });

    const cachedPath = path.join(srcDir, "cached.ts");
    const deferredPath = path.join(srcDir, "deferred.ts");

    fs.writeFileSync(cachedPath, "export const cached = true;\n", "utf-8");
    fs.writeFileSync(deferredPath, "export const deferred = true;\n", "utf-8");

    const initialContents = new Map<string, string>([
      ["src/cached.ts", "export const cached = true;\n"],
    ]);

    const files = hydrateContextFiles(repoDir, [
      { path: "src/cached.ts", reason: "Already loaded" },
      { path: "src/deferred.ts", reason: "Selected outside top-N" },
    ], initialContents);

    assert.deepEqual(
      files.map((file) => file.path),
      ["src/cached.ts", "src/deferred.ts"],
    );
    assert.match(files[1].content, /deferred/);
    assert.equal(initialContents.get("src/deferred.ts"), "export const deferred = true;\n");
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

test("hydrateContextFiles drops LLM-selected paths that escape the repo", () => {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-context-escape-"));

  try {
    const repoDir = path.join(outer, "repo");
    fs.mkdirSync(repoDir);
    fs.writeFileSync(path.join(repoDir, "safe.ts"), "export const safe = true;\n", "utf-8");
    fs.writeFileSync(path.join(outer, "secret.env"), "API_KEY=hunter2\n", "utf-8");

    const files = hydrateContextFiles(repoDir, [
      { path: "safe.ts", reason: "Legit" },
      { path: "../secret.env", reason: "Injected by repo content" },
    ], new Map());

    assert.deepEqual(files.map((file) => file.path), ["safe.ts"]);
  } finally {
    fs.rmSync(outer, { recursive: true, force: true });
  }
});
