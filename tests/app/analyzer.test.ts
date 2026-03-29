import test from "node:test";
import assert from "node:assert/strict";
import { buildCloneOptions, createCloneDirName } from "../../src/analyzer.ts";

test("buildCloneOptions enables long paths on Windows clones", () => {
  assert.deepEqual(
    buildCloneOptions("main", "win32"),
    ["--depth", "1", "--branch", "main", "-c", "core.longpaths=true"],
  );
});

test("buildCloneOptions stays minimal off Windows", () => {
  assert.deepEqual(buildCloneOptions(undefined, "linux"), ["--depth", "1"]);
});

test("createCloneDirName uses a short Windows prefix", () => {
  const cloneDirName = createCloneDirName("win32");
  assert.match(cloneDirName, /^cg-\d+-[a-z0-9]{6}$/);
});
