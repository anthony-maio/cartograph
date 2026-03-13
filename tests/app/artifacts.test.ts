import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRunWorkspace, loadRunManifest } from "../../src/app/cache.ts";
import { exportRunArtifact, writeRunArtifact } from "../../src/app/artifacts.ts";

test("writeRunArtifact records the artifact in the manifest", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-artifact-test-"));

  try {
    const workspace = createRunWorkspace({
      repo: "D:/Development/opencodewiki",
      command: "wiki",
      cacheRoot: tempRoot,
      runId: "run-artifact-1",
      createdAt: "2026-03-13T00:00:00.000Z",
    });

    const artifactPath = writeRunArtifact(workspace.runDir, {
      name: "analysis",
      extension: "json",
      content: "{\"ok\":true}",
    });

    assert.ok(fs.existsSync(artifactPath));

    const manifest = loadRunManifest(workspace.runDir);
    assert.deepEqual(manifest.artifacts.analysis, {
      fileName: "analysis.json",
      relativePath: path.join("artifacts", "analysis.json"),
      format: "json",
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("exportRunArtifact copies a named artifact to the explicit destination", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-export-test-"));

  try {
    const workspace = createRunWorkspace({
      repo: "D:/Development/opencodewiki",
      command: "context",
      cacheRoot: tempRoot,
      runId: "run-artifact-2",
      createdAt: "2026-03-13T00:00:00.000Z",
    });

    writeRunArtifact(workspace.runDir, {
      name: "task-context",
      extension: "md",
      content: "# Context",
    });

    const exportTarget = path.join(tempRoot, "exports", "task-context.md");
    exportRunArtifact(workspace.runDir, "task-context", exportTarget);

    assert.equal(fs.readFileSync(exportTarget, "utf-8"), "# Context");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("exportRunArtifact requires an explicit destination path", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-export-test-"));

  try {
    const workspace = createRunWorkspace({
      repo: "D:/Development/opencodewiki",
      command: "context",
      cacheRoot: tempRoot,
      runId: "run-artifact-3",
      createdAt: "2026-03-13T00:00:00.000Z",
    });

    writeRunArtifact(workspace.runDir, {
      name: "task-context",
      extension: "md",
      content: "# Context",
    });

    assert.throws(
      () => exportRunArtifact(workspace.runDir, "task-context", ""),
      /explicit destination path/i,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
