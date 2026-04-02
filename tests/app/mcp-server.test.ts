import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
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

test("analyze_repo compacts small repos by default and can opt into embedded contents", async () => {
  const server = createCartographMcpServer();
  const client = new Client({ name: "cartograph-test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-mcp-small-"));

  try {
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Small repo\n");
    fs.mkdirSync(path.join(repoDir, "src"));
    fs.writeFileSync(path.join(repoDir, "src", "index.ts"), "import { helper } from './helper';\nexport const value = helper();\n");
    fs.writeFileSync(path.join(repoDir, "src", "helper.ts"), "export const helper = () => 1;\n");

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const compactResult = await client.callTool({
      name: "analyze_repo",
      arguments: {
        repo: repoDir,
      },
    });

    const compactText = compactResult.content.find((part) => part.type === "text");
    assert.ok(compactText && "text" in compactText, "analyze_repo should return JSON text");

    const compactParsed = JSON.parse(compactText.text) as {
      fileContents: Record<string, string>;
      contentPolicy?: {
        mode?: string;
        includeContents?: boolean;
        omittedFileContents?: boolean;
      };
    };

    assert.deepEqual(compactParsed.fileContents, {});
    assert.equal(compactParsed.contentPolicy?.mode, "compact");
    assert.equal(compactParsed.contentPolicy?.includeContents, false);
    assert.equal(compactParsed.contentPolicy?.omittedFileContents, true);

    const fullResult = await client.callTool({
      name: "analyze_repo",
      arguments: {
        repo: repoDir,
        include_contents: true,
      },
    });

    const fullText = fullResult.content.find((part) => part.type === "text");
    assert.ok(fullText && "text" in fullText, "analyze_repo should return JSON text");

    const fullParsed = JSON.parse(fullText.text) as {
      fileContents: Record<string, string>;
      contentPolicy?: {
        mode?: string;
        includeContents?: boolean;
        omittedFileContents?: boolean;
      };
    };

    assert.ok(Object.keys(fullParsed.fileContents).length > 0);
    assert.equal(fullParsed.contentPolicy?.mode, "full");
    assert.equal(fullParsed.contentPolicy?.includeContents, true);
    assert.equal(fullParsed.contentPolicy?.omittedFileContents, false);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
    await Promise.allSettled([client.close(), server.close()]);
  }
});
