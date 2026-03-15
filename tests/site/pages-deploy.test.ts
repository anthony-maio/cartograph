import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("pages workflow deploys the site directory", () => {
  const workflowPath = path.join(repoRoot, ".github", "workflows", "pages.yml");
  const cnamePath = path.join(repoRoot, "site", "CNAME");

  assert.ok(fs.existsSync(workflowPath), ".github/workflows/pages.yml should exist");
  assert.ok(fs.existsSync(cnamePath), "site/CNAME should exist");

  const workflow = fs.readFileSync(workflowPath, "utf-8");
  const cname = fs.readFileSync(cnamePath, "utf-8").trim();

  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path:\s*site/);
  assert.equal(cname, "cartograph.making-minds.ai");
});
