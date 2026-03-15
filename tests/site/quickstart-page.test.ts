import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("quickstart site includes the core install and usage path", () => {
  const indexPath = path.join(repoRoot, "site", "index.html");
  const stylePath = path.join(repoRoot, "site", "style.css");
  const privacyPath = path.join(repoRoot, "site", "privacy.html");

  assert.ok(fs.existsSync(indexPath), "site/index.html should exist");
  assert.ok(fs.existsSync(stylePath), "site/style.css should exist");
  assert.ok(fs.existsSync(privacyPath), "site/privacy.html should exist");

  const html = fs.readFileSync(indexPath, "utf-8");
  const privacyHtml = fs.readFileSync(privacyPath, "utf-8");

  for (const fragment of [
    "@anthony-maio/cartograph",
    "cartograph analyze",
    "cartograph context",
    "/plugin marketplace add anthony-maio/cartograph",
    "/plugin install cartograph@making-minds-tools",
    "cartograph install claude",
    "cartograph install openclaw",
    "cartograph install mcp",
    "use-cartograph",
    "repo-surveyor",
    "5-minute quickstart",
    "privacy.html",
  ]) {
    assert.match(html, new RegExp(escapeForRegExp(fragment), "i"));
  }

  for (const fragment of [
    "Cartograph Privacy Policy",
    "does not send usage telemetry",
    "Gemini",
    "OpenAI",
    "OpenRouter",
    "anthony@making-minds.ai",
  ]) {
    assert.match(privacyHtml, new RegExp(escapeForRegExp(fragment), "i"));
  }
});

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
