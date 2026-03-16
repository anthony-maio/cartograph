import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/run-cli.ts";
import { loadRunManifest } from "../../src/app/cache.ts";

test("analyze subcommand runs static analysis via the explicit command surface", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-cli-analyze-"));

  try {
    const result = await runCli(
      ["analyze", ".", "--static", "--json"],
      { CARTOGRAPH_CACHE_DIR: tempRoot },
    );

    assert.equal(result.code, 0, result.stderr);

    const parsed = JSON.parse(result.stdout) as {
      repoName: string;
      files: unknown[];
      edges: unknown[];
      fileContents: Record<string, string>;
    };

    assert.equal(parsed.repoName, path.basename(process.cwd()));
    assert.ok(parsed.files.length > 0);
    assert.ok(Array.isArray(parsed.edges));
    assert.equal(typeof parsed.fileContents, "object");

    const [repoDir] = fs.readdirSync(tempRoot);
    assert.ok(repoDir);

    const repoCacheDir = path.join(tempRoot, repoDir);
    const [runId] = fs.readdirSync(repoCacheDir);
    assert.ok(runId);

    const runDir = path.join(repoCacheDir, runId);
    const manifest = loadRunManifest(runDir);
    assert.equal(manifest.command, "analyze");
    assert.ok(manifest.artifacts.analysis);
    assert.ok(fs.existsSync(path.join(runDir, "artifacts", "analysis.json")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
