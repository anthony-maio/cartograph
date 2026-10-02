// Copies the package.json version into every manifest that repeats it.
// Run after `npm version <x>` (wired up as the npm "version" lifecycle script).
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8"));

export const VERSIONED_MANIFESTS = {
  "server.json": (json) => {
    json.version = version;
    for (const pkg of json.packages ?? []) pkg.version = version;
  },
  ".claude-plugin/marketplace.json": (json) => {
    if (json.metadata) json.metadata.version = version;
    for (const plugin of json.plugins ?? []) plugin.version = version;
  },
  "plugins/cartograph/.claude-plugin/plugin.json": (json) => {
    json.version = version;
  },
};

for (const [relativePath, update] of Object.entries(VERSIONED_MANIFESTS)) {
  const fullPath = path.join(repoRoot, relativePath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const json = JSON.parse(raw);
  update(json);
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(fullPath, JSON.stringify(json, null, 2).replace(/\n/g, eol) + eol, "utf-8");
  console.log(`${relativePath} -> ${version}`);
}
