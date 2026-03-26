import test from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCartographMcpServer } from "../../src/app/mcp-server.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("mcp server exposes build_task_packet and returns typed packets", async () => {
  const server = createCartographMcpServer();
  const client = new Client({ name: "cartograph-test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      ["analyze_repo", "build_task_packet", "get_file_contents"],
    );

    const result = await client.callTool({
      name: "build_task_packet",
      arguments: {
        repo: repoRoot,
        type: "bug-fix",
        task: "Fix task packet sync",
      },
    });

    const textPart = result.content.find((part) => part.type === "text");
    assert.ok(textPart && "text" in textPart, "build_task_packet should return JSON text");

    const packet = JSON.parse(textPart.text) as {
      taskType: string;
      taskSummary: string;
      keyFiles: Array<{ path: string }>;
      validationTargets: Array<{ path: string }>;
    };

    assert.equal(packet.taskType, "bug-fix");
    assert.equal(packet.taskSummary, "Fix task packet sync");
    assert.ok(packet.keyFiles.length > 0);
    assert.ok(Array.isArray(packet.validationTargets));
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
});
