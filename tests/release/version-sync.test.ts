import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION } from "../../src/version.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf-8"));

test("every published manifest carries the package.json version", () => {
  const { version } = readJson("package.json");

  const server = readJson("server.json");
  const marketplace = readJson(".claude-plugin/marketplace.json");
  const plugin = readJson("plugins/cartograph/.claude-plugin/plugin.json");

  const found: Record<string, string> = {
    "src/version.ts": VERSION,
    "server.json": server.version,
    ...Object.fromEntries(server.packages.map((pkg: { version: string }, i: number) => [`server.json packages[${i}]`, pkg.version])),
    "marketplace.json metadata": marketplace.metadata.version,
    ...Object.fromEntries(marketplace.plugins.map((p: { version: string }, i: number) => [`marketplace.json plugins[${i}]`, p.version])),
    "plugin.json": plugin.version,
  };

  for (const [where, actual] of Object.entries(found)) {
    assert.equal(actual, version, `${where} is ${actual}; run \`npm run version:sync\``);
  }
});

test("no source file hardcodes a release version", () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.ts$/.test(entry.name) && /version:\s*"\d+\.\d+\.\d+"|\.version\("\d+\.\d+\.\d+"\)/.test(fs.readFileSync(full, "utf-8"))) {
        offenders.push(path.relative(repoRoot, full));
      }
    }
  };
  walk(path.join(repoRoot, "src"));

  assert.deepEqual(offenders, [], "import VERSION from src/version.ts instead");
});
