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
  const examplesIndexPath = path.join(repoRoot, "site", "examples", "index.html");
  const packetMarkdownPath = path.join(repoRoot, "site", "examples", "llama-cpp-task-packet.md");
  const packetJsonPath = path.join(repoRoot, "site", "examples", "llama-cpp-task-packet.json");
  const deepwikiPath = path.join(repoRoot, "site", "examples", "llama-cpp-deepwiki.md");

  assert.ok(fs.existsSync(indexPath), "site/index.html should exist");
  assert.ok(fs.existsSync(stylePath), "site/style.css should exist");
  assert.ok(fs.existsSync(privacyPath), "site/privacy.html should exist");
  assert.ok(fs.existsSync(examplesIndexPath), "site/examples/index.html should exist");
  assert.ok(fs.existsSync(packetMarkdownPath), "site/examples/llama-cpp-task-packet.md should exist");
  assert.ok(fs.existsSync(packetJsonPath), "site/examples/llama-cpp-task-packet.json should exist");
  assert.ok(fs.existsSync(deepwikiPath), "site/examples/llama-cpp-deepwiki.md should exist");

  const html = fs.readFileSync(indexPath, "utf-8");
  const privacyHtml = fs.readFileSync(privacyPath, "utf-8");
  const examplesHtml = fs.readFileSync(examplesIndexPath, "utf-8");

  for (const fragment of [
    "@anthony-maio/cartograph",
    "cartograph analyze",
    "cartograph packet",
    "cartograph context",
    "/plugin marketplace add anthony-maio/cartograph",
    "/plugin install cartograph@making-minds-tools",
    "cartograph install claude",
    "cartograph install openclaw",
    "cartograph install mcp",
    "build_task_packet",
    "shared dependency hubs",
    "io.github.anthony-maio/cartograph",
    "registry.modelcontextprotocol.io",
    "examples/index.html",
    "examples/llama-cpp-task-packet.md",
    "examples/llama-cpp-deepwiki.md",
    "use-cartograph",
    "repo-surveyor",
    "benchmark:task-packets",
    "llama.cpp task packet",
    "DeepWiki-style brief",
    "5-minute quickstart",
    "privacy.html",
  ]) {
    assert.match(html, new RegExp(escapeForRegExp(fragment), "i"));
  }

  for (const fragment of [
    "Sample artifacts",
    "Open markdown packet",
    "Open JSON packet",
    "DeepWiki-style summary",
    "llama.cpp",
  ]) {
    assert.match(examplesHtml, new RegExp(escapeForRegExp(fragment), "i"));
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
