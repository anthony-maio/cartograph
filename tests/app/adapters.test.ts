import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getAdapter, listAdapters } from "../../src/app/adapters/index.ts";

test("adapter registry exposes the supported adapters and user-scope install roots", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-adapters-"));

  try {
    assert.deepEqual(
      listAdapters().map((adapter) => adapter.id),
      ["claude", "openclaw", "mcp"],
    );

    const claude = getAdapter("claude");
    const openclaw = getAdapter("openclaw");
    const mcp = getAdapter("mcp");

    const env = {
      CARTOGRAPH_CLAUDE_HOME: path.join(tempRoot, ".claude"),
      CARTOGRAPH_OPENCLAW_HOME: path.join(tempRoot, ".openclaw"),
      CARTOGRAPH_MCP_HOME: path.join(tempRoot, ".cartograph", "mcp"),
    };

    assert.equal(claude.resolveTargetRoot(env), path.join(tempRoot, ".claude"));
    assert.equal(openclaw.resolveTargetRoot(env), path.join(tempRoot, ".openclaw"));
    assert.equal(mcp.resolveTargetRoot(env), path.join(tempRoot, ".cartograph", "mcp"));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
