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
