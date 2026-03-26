import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../helpers/run-cli.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("README and CLI help describe the packaged command surface", async () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf-8");
  const help = await runCli(["--help"]);
  const output = `${help.stdout}\n${help.stderr}`;

  assert.equal(help.code, 0);

  for (const fragment of [
    "cartograph analyze <repo>",
    "cartograph packet <repo> --type <type> --task",
    "cartograph context <repo> --task",
    "cartograph wiki <repo>",
    "cartograph export <run-id> --to <path>",
    "cartograph install <claude|openclaw|mcp>",
    "cartograph doctor [target] [--json]",
    "CARTOGRAPH_API_KEY",
    "use-cartograph",
    "repo-surveyor",
  ]) {
    assert.match(readme, new RegExp(escapeForRegExp(fragment)));
  }

  assert.match(output, /\binstall\b/);
  assert.match(output, /\bdoctor\b/);
  assert.match(output, /\bpacket\b/);
  assert.match(output, /CARTOGRAPH_API_KEY/);
});

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
