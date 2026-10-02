import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { analyzeFiles, extractImports, getFileContent, listRepoFiles, resolveRepoPath } from "../../src/analyzer.ts";

function makeRepo(files: Record<string, string>): string {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-resolve-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(repoDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return repoDir;
}

function edgesOf(repoDir: string): string[] {
  return analyzeFiles(repoDir).edges.map((edge) => `${edge.from} -> ${edge.to}`).sort();
}

function withRepo(files: Record<string, string>, fn: (repoDir: string) => void) {
  const repoDir = makeRepo(files);
  try {
    fn(repoDir);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
}

// --- path containment ------------------------------------------------------

test("getFileContent refuses paths that escape the repo root", () => {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-escape-"));
  try {
    const repoDir = path.join(outer, "repo");
    fs.mkdirSync(repoDir);
    fs.writeFileSync(path.join(repoDir, "inside.ts"), "export const ok = 1;\n");
    fs.writeFileSync(path.join(outer, "secret.txt"), "TOP SECRET\n");

    assert.match(getFileContent(repoDir, "inside.ts"), /ok/);
    assert.equal(getFileContent(repoDir, "../secret.txt"), "");
    assert.equal(getFileContent(repoDir, "sub/../../secret.txt"), "");
    assert.equal(getFileContent(repoDir, path.join(outer, "secret.txt")), "");
    assert.equal(resolveRepoPath(repoDir, ".."), null);
    assert.equal(resolveRepoPath(repoDir, "."), null);
  } finally {
    fs.rmSync(outer, { recursive: true, force: true });
  }
});

test("getFileContent refuses symlinks that point outside the repo", (t) => {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-symlink-"));
  try {
    const repoDir = path.join(outer, "repo");
    fs.mkdirSync(repoDir);
    fs.writeFileSync(path.join(outer, "secret.txt"), "TOP SECRET\n");
    try {
      fs.symlinkSync(path.join(outer, "secret.txt"), path.join(repoDir, "link.txt"));
    } catch {
      t.skip("symlinks are not available on this machine");
      return;
    }

    assert.equal(getFileContent(repoDir, "link.txt"), "");
  } finally {
    fs.rmSync(outer, { recursive: true, force: true });
  }
});

// --- import extraction -----------------------------------------------------

test("extractImports handles default+named, multi-line, re-export, and dynamic imports", () => {
  const source = [
    'import React, { useState } from "react";',
    "import {",
    "  a,",
    "  b,",
    '} from "./multi";',
    'export * from "./reexported";',
    'const lazy = await import("./lazy");',
    'import "./side-effect";',
  ].join("\n");

  assert.deepEqual(
    extractImports(source, "typescript").sort(),
    ["./lazy", "./multi", "./reexported", "./side-effect", "react"],
  );
});

test("extractImports reads grouped Go import blocks without catching other string literals", () => {
  const source = [
    "package main",
    "",
    "import (",
    '\t"fmt"',
    '\tsvc "example.com/app/internal/service"',
    ")",
    "",
    "var names = []string{",
    '\t"not-an-import"',
    "}",
  ].join("\n");

  assert.deepEqual(extractImports(source, "go").sort(), ["example.com/app/internal/service", "fmt"]);
});

// --- import resolution -----------------------------------------------------

test("files with the same basename do not overwrite each other in the graph", () => {
  withRepo({
    "src/a/index.ts": "export const a = 1;\n",
    "src/b/index.ts": "export const b = 2;\n",
    "src/main.ts": 'import { a } from "./a";\nimport { b } from "./b/index";\n',
  }, (repoDir) => {
    assert.deepEqual(edgesOf(repoDir), [
      "src/main.ts -> src/a/index.ts",
      "src/main.ts -> src/b/index.ts",
    ]);
  });
});

test("bare package imports never bind to repo files that share the name", () => {
  withRepo({
    "src/config.ts": "export const config = {};\n",
    "src/react.ts": "export const fake = true;\n",
    "src/app.ts": 'import config from "config";\nimport React from "react";\n',
    // Not a sibling of run.py, so `import types` must stay the stdlib module
    "lib/types.py": "X = 1\n",
    "tools/run.py": "import types\nimport os\n",
  }, (repoDir) => {
    assert.deepEqual(edgesOf(repoDir), []);
  });
});

test("TypeScript .js specifiers resolve to the .ts source", () => {
  withRepo({
    "src/util.ts": "export const u = 1;\n",
    "src/main.ts": 'import { u } from "./util.js";\n',
  }, (repoDir) => {
    assert.deepEqual(edgesOf(repoDir), ["src/main.ts -> src/util.ts"]);
  });
});

test("Python dotted, relative, and package imports resolve to files", () => {
  withRepo({
    "app/__init__.py": "",
    "app/models/__init__.py": "from .user import User\n",
    "app/models/user.py": "class User: pass\n",
    "app/services/billing.py": "from app.models.user import User\nfrom ..models import User as U\n",
    "app/main.py": "import app.services.billing\n",
  }, (repoDir) => {
    assert.deepEqual(edgesOf(repoDir), [
      "app/main.py -> app/services/billing.py",
      "app/models/__init__.py -> app/models/user.py",
      "app/services/billing.py -> app/models/__init__.py",
      "app/services/billing.py -> app/models/user.py",
    ]);
  });
});

test("Go imports resolve through the go.mod module path", () => {
  withRepo({
    "go.mod": "module example.com/app\n\ngo 1.22\n",
    "internal/service/service.go": "package service\n\nfunc Run() {}\n",
    "internal/service/service_test.go": "package service\n",
    "cmd/app/main.go": 'package main\n\nimport (\n\t"fmt"\n\t"example.com/app/internal/service"\n)\n',
  }, (repoDir) => {
    assert.deepEqual(edgesOf(repoDir), ["cmd/app/main.go -> internal/service/service.go"]);
  });
});

test("C includes resolve relative to the including file", () => {
  withRepo({
    "src/llama.h": "int llama(void);\n",
    "src/llama.cpp": '#include "llama.h"\n#include <vector>\n',
  }, (repoDir) => {
    assert.deepEqual(edgesOf(repoDir), ["src/llama.cpp -> src/llama.h"]);
  });
});

test("duplicate imports of the same file produce a single edge", () => {
  withRepo({
    "src/dep.ts": "export const d = 1;\n",
    "src/main.ts": 'import { d } from "./dep";\nconst again = require("./dep");\n',
  }, (repoDir) => {
    assert.deepEqual(edgesOf(repoDir), ["src/main.ts -> src/dep.ts"]);
  });
});

// --- file listing ----------------------------------------------------------

test("listRepoFiles respects .gitignore in git repositories", (t) => {
  withRepo({
    ".gitignore": "generated/\n*.log\n",
    "src/index.ts": "export const x = 1;\n",
    "generated/big.ts": "export const generated = true;\n",
    "debug.log": "noise\n",
  }, (repoDir) => {
    try {
      execFileSync("git", ["init", "-q"], { cwd: repoDir, stdio: "ignore" });
    } catch {
      t.skip("git is not available");
      return;
    }

    assert.deepEqual(listRepoFiles(repoDir).sort(), [".gitignore", "src/index.ts"]);
  });
});

test("listRepoFiles falls back to walking non-git directories", () => {
  withRepo({
    "src/index.ts": "export const x = 1;\n",
    "node_modules/pkg/index.js": "module.exports = 1;\n",
    ".hidden/file.ts": "export const h = 1;\n",
  }, (repoDir) => {
    assert.deepEqual(listRepoFiles(repoDir), ["src/index.ts"]);
  });
});
