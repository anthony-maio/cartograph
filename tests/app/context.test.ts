import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { hydrateContextFiles, selectStaticContextFiles } from "../../src/app/context.ts";
import type { FileNode } from "../../src/schema.ts";

test("static context keeps direct filename and symbol matches ahead of busy dependency hubs", () => {
  const file = (filePath: string, importanceScore: number, exports: string[] = [], imports: string[] = []): FileNode => ({
    path: filePath, importanceScore, exports, imports, language: "typescript", lines: 300, bytes: 6000,
  });
  const files = [
    file("docs/router.md", 999),
    ...Array.from({ length: 7 }, (_, index) => file(`src/shared${index}.ts`, 150 - index, [], ["./router"])),
    file("src/router.ts", 0),
    file("src/session.ts", 0, ["validateCredential"]),
    file("tests/router.test.ts", 0, [], ["../src/router"]),
  ];
  const selected = selectStaticContextFiles({
    repoId: "example", repoName: "example", taskSummary: "validateCredential in router",
    files,
    edges: files.filter((item) => item.imports.length > 0).map((item) => ({ from: item.path, to: "src/router.ts" })),
  }, 6);

  assert.equal(selected.length, 6);
  assert.deepEqual(new Set(selected.slice(0, 2).map((item) => item.path)), new Set(["src/router.ts", "src/session.ts"]));
  assert.ok(selected.some((item) => item.path === "tests/router.test.ts"));
});

test("static hydration returns a bounded exact source window around late task matches", () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-context-window-"));
  try {
    const lines = [
      "// Router setup",
      ...Array.from({ length: 300 }, (_, index) => `const route${index} = ${index};`),
      "function validateCredential(credential) {",
      '  if (credential.expired) throw new Error("Credential expiry is not allowed");',
      "  return credential;",
      "}",
      ...Array.from({ length: 100 }, (_, index) => `// unrelated handler ${index}`),
    ];
    const source = lines.join("\r\n");
    fs.writeFileSync(path.join(repoDir, "router.ts"), source);
    const contents = new Map<string, string>();
    const [selected] = hydrateContextFiles(repoDir, [{ path: "router.ts", reason: "Task match" }], contents, 200,
      "reject credential expiry");

    assert.match(selected.content, /Credential expiry is not allowed/);
    assert.ok(selected.startLine! > 200);
    assert.ok(selected.endLine! - selected.startLine! + 1 <= 80);
    assert.equal(selected.truncated, true);
    assert.equal(selected.content, lines.slice(selected.startLine! - 1, selected.endLine!).join("\r\n"));
    assert.equal(contents.get("router.ts"), selected.content);
    assert.doesNotMatch(selected.content, /more lines truncated/);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

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
      ["src/cached.ts", "// Previously selected model context\n"],
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
    assert.equal(files[0].content, "// Previously selected model context\n");
    assert.equal(files[0].startLine, undefined);
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
