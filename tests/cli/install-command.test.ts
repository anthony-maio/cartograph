import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/run-cli.ts";

test("install command requires an explicit adapter target", async () => {
  const result = await runCli(["install"]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /supported targets/i);
});

test("install command writes user-scope assets for claude, openclaw, and mcp", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-install-"));
  const env = {
    CARTOGRAPH_CLAUDE_HOME: path.join(tempRoot, ".claude"),
    CARTOGRAPH_OPENCLAW_HOME: path.join(tempRoot, ".openclaw"),
    CARTOGRAPH_MCP_HOME: path.join(tempRoot, ".cartograph", "mcp"),
  };

  try {
    const claude = await runCli(["install", "claude"], env);
    const openclaw = await runCli(["install", "openclaw"], env);
    const mcp = await runCli(["install", "mcp"], env);

    assert.equal(claude.code, 0, claude.stderr);
    assert.equal(openclaw.code, 0, openclaw.stderr);
    assert.equal(mcp.code, 0, mcp.stderr);

    assert.ok(fs.existsSync(path.join(env.CARTOGRAPH_CLAUDE_HOME, "skills", "use-cartograph", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(env.CARTOGRAPH_CLAUDE_HOME, "skills", "repo-surveyor", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(env.CARTOGRAPH_CLAUDE_HOME, "agents", "repo-scout.md")));
    assert.ok(fs.existsSync(path.join(env.CARTOGRAPH_OPENCLAW_HOME, "skills", "use-cartograph", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(env.CARTOGRAPH_OPENCLAW_HOME, "skills", "repo-surveyor", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(env.CARTOGRAPH_OPENCLAW_HOME, "skills", "use-cartograph", "openprose", "repo-docs.prose")));
    assert.ok(fs.existsSync(path.join(env.CARTOGRAPH_OPENCLAW_HOME, "skills", "repo-surveyor", "openprose", "repo-docs.prose")));
    assert.ok(fs.existsSync(path.join(env.CARTOGRAPH_MCP_HOME, "cartograph-mcp.json")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
