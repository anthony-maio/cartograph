import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("repository includes the minimum public release surface", () => {
  for (const relativePath of [
    "LICENSE",
    "CONTRIBUTING.md",
    "SECURITY.md",
    ".github/workflows/ci.yml",
    "scripts/pack-smoke.mjs",
  ]) {
    assert.ok(fs.existsSync(path.join(repoRoot, relativePath)), `${relativePath} should exist`);
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8"),
  ) as {
    repository?: unknown;
    homepage?: unknown;
    bugs?: unknown;
    keywords?: unknown;
    engines?: unknown;
    scripts?: Record<string, string>;
  };

  assert.ok(packageJson.repository, "package.json should define repository metadata");
  assert.ok(packageJson.homepage, "package.json should define a homepage");
  assert.ok(packageJson.bugs, "package.json should define a bug tracker");
  assert.ok(Array.isArray(packageJson.keywords) && packageJson.keywords.length > 0, "package.json should define keywords");
  assert.ok(packageJson.engines, "package.json should declare supported Node engines");
  assert.match(packageJson.scripts?.["pack:smoke"] || "", /pack-smoke\.mjs/);
  assert.match(packageJson.scripts?.["release:check"] || "", /pack:smoke/);

  const ciWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf-8");
  assert.match(ciWorkflow, /npm ci/);
  assert.match(ciWorkflow, /npm test/);
  assert.match(ciWorkflow, /npm run check/);
  assert.match(ciWorkflow, /npm run build/);
  assert.match(ciWorkflow, /npm run pack:smoke/);
});
