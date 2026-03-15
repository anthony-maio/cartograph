import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("quickstart site includes the core install and usage path", () => {
  const indexPath = path.join(repoRoot, "site", "index.html");
  const stylePath = path.join(repoRoot, "site", "style.css");

  assert.ok(fs.existsSync(indexPath), "site/index.html should exist");
  assert.ok(fs.existsSync(stylePath), "site/style.css should exist");

  const html = fs.readFileSync(indexPath, "utf-8");

  for (const fragment of [
    "@anthony-maio/cartograph",
    "cartograph analyze",
    "cartograph context",
    "cartograph install claude",
    "cartograph install openclaw",
    "cartograph install mcp",
    "use-cartograph",
    "repo-surveyor",
    "5-minute quickstart",
  ]) {
    assert.match(html, new RegExp(escapeForRegExp(fragment), "i"));
  }
});

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
