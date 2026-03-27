import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = path.join(repoRoot, "benchmarks", "task-packets", "manifest.json");

test("task packet benchmark manifest defines a balanced public repo suite", () => {
  assert.ok(fs.existsSync(manifestPath), "benchmarks/task-packets/manifest.json should exist");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    version?: string;
    cases?: Array<{
      id?: string;
      repo?: string;
      packetType?: string;
      task?: string;
      changedFiles?: string[];
      why?: string;
    }>;
  };

  assert.equal(manifest.version, "1");
  assert.ok(Array.isArray(manifest.cases), "manifest should include cases");
  assert.ok(manifest.cases.length >= 6, "benchmark should cover at least six public repos");

  const ids = new Set(manifest.cases.map((entry) => entry.id));
  for (const expectedId of [
    "llama-cpp-bug-fix",
    "vscode-pr-review",
    "nextjs-trace-flow",
    "fastapi-bug-fix",
    "open-webui-task",
    "kubernetes-trace-flow",
  ]) {
    assert.ok(ids.has(expectedId), `manifest should include ${expectedId}`);
  }

  for (const entry of manifest.cases) {
    assert.match(entry.repo || "", /^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    assert.ok(entry.task && entry.task.length >= 12, "each case should define a concrete task");
    assert.ok(entry.why && entry.why.length >= 12, "each case should define why it exists");
    assert.ok(["task", "bug-fix", "pr-review", "trace-flow", "change-request"].includes(entry.packetType || ""), "packetType should be valid");
    if (entry.changedFiles) {
      assert.ok(entry.changedFiles.length > 0, "changedFiles should not be empty when present");
    }
  }
});

test("task packet benchmark runner lists cases and supports dry-run planning", () => {
  const listResult = spawnSync(process.execPath, ["scripts/task-packet-benchmark.mjs", "--list"], {
    cwd: repoRoot,
    encoding: "utf-8",
  });

  assert.equal(listResult.status, 0, listResult.stderr);
  assert.match(listResult.stdout, /llama-cpp-bug-fix/);
  assert.match(listResult.stdout, /vscode-pr-review/);
  assert.match(listResult.stdout, /https:\/\/github\.com\/ggml-org\/llama\.cpp/);

  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-benchmark-"));

  try {
    const dryRunResult = spawnSync(
      process.execPath,
      [
        "scripts/task-packet-benchmark.mjs",
        "--case",
        "llama-cpp-bug-fix",
        "--dry-run",
        "--output",
        outputDir,
      ],
      {
        cwd: repoRoot,
        encoding: "utf-8",
      },
    );

    assert.equal(dryRunResult.status, 0, dryRunResult.stderr);
    assert.match(dryRunResult.stdout, /dist[\\/]+cli\.cjs packet https:\/\/github\.com\/ggml-org\/llama\.cpp --type bug-fix/i);
    assert.match(dryRunResult.stdout, /llama-cpp-bug-fix\.json/);
    assert.equal(fs.readdirSync(outputDir).length, 0, "dry-run should not write output files");
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
