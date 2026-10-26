import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("MCP registry arguments launch a server that completes initialization", { timeout: 20_000 }, async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "server.json"), "utf-8"));
  const npmPackage = manifest.packages.find((entry: { registryType: string }) => entry.registryType === "npm");
  assert.equal(npmPackage?.transport.type, "stdio");
  const args = (npmPackage.packageArguments ?? []).map((argument: { type: string; value: string }) => {
    assert.equal(argument.type, "positional");
    return argument.value;
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.join(repoRoot, "src", "cli.ts"), ...args],
    cwd: repoRoot,
    stderr: "pipe",
  });
  const client = new Client({ name: "cartograph-manifest-test", version: "1.0.0" });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => { stderr += String(chunk); });
  try {
    await client.connect(transport, { timeout: 10_000 });
    assert.equal(client.getServerVersion()?.version, manifest.version);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "build_task_packet"));
  } catch (error) {
    throw new Error(`Registry command did not start an MCP server: ${stderr}`, { cause: error });
  } finally {
    await client.close();
  }
});
