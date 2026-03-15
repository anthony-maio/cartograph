import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRunWorkspace } from "../../src/app/cache.ts";
import { writeRunArtifact } from "../../src/app/artifacts.ts";
import { runCli } from "../helpers/run-cli.ts";

const repoUnderTest = "repo-under-test";

test("export subcommand copies the sole artifact from a cached run", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-export-cli-"));

  try {
    const workspace = createRunWorkspace({
      repo: repoUnderTest,
      command: "analyze",
      cacheRoot: tempRoot,
      runId: "run-export-cli",
      createdAt: "2026-03-13T00:00:00.000Z",
    });

    writeRunArtifact(workspace.runDir, {
      name: "analysis",
      extension: "md",
      content: "# Exported",
    });

    const exportPath = path.join(tempRoot, "exports", "analysis.md");
    const result = await runCli(
      ["export", "run-export-cli", "--to", exportPath],
      { CARTOGRAPH_CACHE_DIR: tempRoot },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.equal(fs.readFileSync(exportPath, "utf-8"), "# Exported");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
