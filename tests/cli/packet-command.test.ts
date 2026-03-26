import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/run-cli.ts";
import { loadRunManifest } from "../../src/app/cache.ts";

test("packet subcommand emits a typed task packet and caches its artifact", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-cli-packet-"));

  try {
    const result = await runCli(
      ["packet", ".", "--type", "bug-fix", "--task", "Fix task packet generation"],
      { CARTOGRAPH_CACHE_DIR: tempRoot },
    );

    assert.equal(result.code, 0, result.stderr);

    const parsed = JSON.parse(result.stdout) as {
      taskType: string;
      taskSummary: string;
      keyFiles: Array<{ path: string }>;
      validationTargets: Array<{ path: string }>;
      details: Record<string, unknown>;
    };

    assert.equal(parsed.taskType, "bug-fix");
    assert.equal(parsed.taskSummary, "Fix task packet generation");
    assert.ok(parsed.keyFiles.length > 0);
    assert.ok(Array.isArray(parsed.validationTargets));
    assert.equal(typeof parsed.details, "object");

    const [repoDir] = fs.readdirSync(tempRoot);
    assert.ok(repoDir);

    const repoCacheDir = path.join(tempRoot, repoDir);
    const [runId] = fs.readdirSync(repoCacheDir);
    assert.ok(runId);

    const runDir = path.join(repoCacheDir, runId);
    const manifest = loadRunManifest(runDir);
    assert.equal(manifest.command, "packet");
    assert.ok(manifest.artifacts["task-packet"]);
    assert.ok(fs.existsSync(path.join(runDir, "artifacts", "task-packet.json")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
