import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// The skill and agent variants are intentionally different per host (see assets/README.md).
// The repo's own .claude/skills is the one place that should be an exact copy of the
// CLI-installed assets, so contributors dogfood exactly what `cartograph install claude` ships.
test(".claude/skills matches the assets that `cartograph install claude` ships", () => {
  const canonicalRoot = path.join(repoRoot, "assets", "claude", "skills");
  const mirrorRoot = path.join(repoRoot, ".claude", "skills");

  const skills = fs.readdirSync(canonicalRoot).filter((skill) => fs.existsSync(path.join(canonicalRoot, skill, "SKILL.md")));
  assert.ok(skills.length > 0);

  for (const skill of skills) {
    const canonical = path.join(canonicalRoot, skill, "SKILL.md");
    const mirror = path.join(mirrorRoot, skill, "SKILL.md");
    assert.ok(fs.existsSync(mirror), `${path.relative(repoRoot, mirror)} is missing`);

    const normalize = (file: string) => fs.readFileSync(file, "utf-8").replace(/\r\n/g, "\n");
    assert.equal(
      normalize(mirror),
      normalize(canonical),
      `${path.relative(repoRoot, mirror)} drifted from assets/claude; copy it over again`,
    );
  }
});
