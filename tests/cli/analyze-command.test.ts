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

test("analyze subcommand compacts small repo JSON output by default", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-cli-small-"));
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-small-repo-"));

  try {
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Small repo\n");
    fs.mkdirSync(path.join(repoDir, "src"));
    fs.writeFileSync(
      path.join(repoDir, "src", "index.ts"),
      [
        "import { helper } from './helper';",
        "export function run() {",
        "  return helper('cartograph');",
        "}",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(repoDir, "src", "helper.ts"),
      [
        "export function helper(value: string) {",
        "  return value.toUpperCase();",
        "}",
      ].join("\n"),
    );
    fs.writeFileSync(path.join(repoDir, "package.json"), JSON.stringify({ name: "small-repo" }, null, 2));

    const result = await runCli(
      ["analyze", repoDir, "--static", "--json"],
      { CARTOGRAPH_CACHE_DIR: tempRoot },
    );

    assert.equal(result.code, 0, result.stderr);

    const parsed = JSON.parse(result.stdout) as {
      fileContents: Record<string, string>;
      contentPolicy?: {
        mode?: string;
        includeContents?: boolean;
        omittedFileContents?: boolean;
      };
    };

    assert.deepEqual(parsed.fileContents, {}, "small repos should omit embedded file contents by default");
    assert.equal(parsed.contentPolicy?.mode, "compact");
    assert.equal(parsed.contentPolicy?.includeContents, false);
    assert.equal(parsed.contentPolicy?.omittedFileContents, true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

test("analyze subcommand embeds contents for small repos when explicitly requested", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-cli-small-full-"));
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-small-repo-full-"));

  try {
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Small repo\n");
    fs.mkdirSync(path.join(repoDir, "src"));
    fs.writeFileSync(path.join(repoDir, "src", "index.ts"), "export const value = 1;\n");
    fs.writeFileSync(path.join(repoDir, "src", "helper.ts"), "export const helper = () => value;\n");

    const result = await runCli(
      ["analyze", repoDir, "--static", "--json", "--include-contents"],
      { CARTOGRAPH_CACHE_DIR: tempRoot },
    );

    assert.equal(result.code, 0, result.stderr);

    const parsed = JSON.parse(result.stdout) as {
      fileContents: Record<string, string>;
      contentPolicy?: {
        mode?: string;
        includeContents?: boolean;
        omittedFileContents?: boolean;
      };
    };

    assert.ok(Object.keys(parsed.fileContents).length > 0, "explicit requests should embed file contents");
    assert.equal(parsed.contentPolicy?.mode, "full");
    assert.equal(parsed.contentPolicy?.includeContents, true);
    assert.equal(parsed.contentPolicy?.omittedFileContents, false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});
