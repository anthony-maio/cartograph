import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("claude marketplace manifest points at the cartograph plugin", () => {
  const marketplacePath = path.join(repoRoot, ".claude-plugin", "marketplace.json");
  assert.ok(fs.existsSync(marketplacePath), ".claude-plugin/marketplace.json should exist");

  const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf-8")) as {
    name?: string;
    plugins?: Array<{ name?: string; source?: string }>;
  };

  assert.equal(marketplace.name, "making-minds-tools");
  assert.ok(Array.isArray(marketplace.plugins), "marketplace should define plugins");
  assert.deepEqual(marketplace.plugins?.map((plugin) => plugin.name), ["cartograph"]);
  assert.equal(marketplace.plugins?.[0]?.source, "./plugins/cartograph");
});

test("cartograph plugin bundles the expected assets", () => {
  const pluginRoot = path.join(repoRoot, "plugins", "cartograph");

  for (const relativePath of [
    ".claude-plugin/plugin.json",
    ".mcp.json",
    "commands/cartograph/analyze.md",
    "commands/cartograph/context.md",
    "commands/cartograph/wiki.md",
    "skills/use-cartograph/SKILL.md",
    "skills/repo-surveyor/SKILL.md",
    "agents/repo-scout.md",
    "agents/dependency-tracer.md",
    "agents/context-picker.md",
    "agents/api-surface-writer.md",
    "agents/wiki-writer.md",
  ]) {
    assert.ok(fs.existsSync(path.join(pluginRoot, relativePath)), `${relativePath} should exist`);
  }

  const pluginManifest = JSON.parse(
    fs.readFileSync(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "utf-8"),
  ) as { name?: string; description?: string };
  assert.equal(pluginManifest.name, "cartograph");
  assert.match(pluginManifest.description ?? "", /MCP server/i);

  const mcpManifest = JSON.parse(
    fs.readFileSync(path.join(pluginRoot, ".mcp.json"), "utf-8"),
  ) as Record<string, { command?: string; args?: string[] }>;
  assert.equal(mcpManifest.cartograph?.command, "npx");
  assert.deepEqual(mcpManifest.cartograph?.args, ["-y", "@anthony-maio/cartograph", "mcp"]);
});
