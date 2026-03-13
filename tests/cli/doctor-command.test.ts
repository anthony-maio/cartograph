import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/run-cli.ts";

interface DoctorResult {
  adapters: Array<{
    id: string;
    installed: boolean;
    targetRoot: string;
    assets: Array<{ label: string; path: string; exists: boolean }>;
  }>;
}

test("doctor reports installed and missing adapter assets", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-doctor-"));
  const env = {
    CARTOGRAPH_CLAUDE_HOME: path.join(tempRoot, ".claude"),
    CARTOGRAPH_OPENCLAW_HOME: path.join(tempRoot, ".openclaw"),
    CARTOGRAPH_MCP_HOME: path.join(tempRoot, ".cartograph", "mcp"),
  };

  try {
    const before = await runCli(["doctor", "--json"], env);
    assert.equal(before.code, 0, before.stderr);

    const initial = JSON.parse(before.stdout) as DoctorResult;
    assert.equal(initial.adapters.length, 3);
    assert.ok(initial.adapters.every((adapter) => adapter.installed === false));

    const install = await runCli(["install", "claude"], env);
    assert.equal(install.code, 0, install.stderr);

    const after = await runCli(["doctor", "--json"], env);
    assert.equal(after.code, 0, after.stderr);

    const report = JSON.parse(after.stdout) as DoctorResult;
    const claude = report.adapters.find((adapter) => adapter.id === "claude");
    const openclaw = report.adapters.find((adapter) => adapter.id === "openclaw");

    assert.equal(claude?.installed, true);
    assert.ok(claude?.assets.some((asset) => asset.label === "skill:cartograph" && asset.exists));
    assert.equal(openclaw?.installed, false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
