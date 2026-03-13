import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../helpers/run-cli.ts";

test("analyze subcommand runs static analysis via the explicit command surface", async () => {
  const result = await runCli(["analyze", ".", "--static", "--json"]);

  assert.equal(result.code, 0, result.stderr);

  const parsed = JSON.parse(result.stdout) as {
    repoName: string;
    files: unknown[];
    edges: unknown[];
    fileContents: Record<string, string>;
  };

  assert.equal(parsed.repoName, "cartograph-foundation");
  assert.ok(parsed.files.length > 0);
  assert.ok(Array.isArray(parsed.edges));
  assert.equal(typeof parsed.fileContents, "object");
});
