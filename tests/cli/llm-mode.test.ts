import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/run-cli.ts";

// Minimal OpenAI-compatible endpoint that records every prompt it receives
async function startFakeLlm(): Promise<{ host: string; prompts: string[]; close: () => Promise<void> }> {
  const prompts: string[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const prompt = JSON.parse(body).messages?.[0]?.content ?? "";
      prompts.push(prompt);

      const answer = prompt.startsWith("Analyze this source file")
        ? { purpose: "Does a thing", publicApi: "fn()", dependencies: [], architecturalRole: "utility" }
        : { overview: "Overview", architecture: "Architecture", patterns: "Patterns", modules: [], contextGuide: [] };

      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        id: "fake",
        object: "chat.completion",
        created: 0,
        model: "fake",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(answer) } }],
      }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    host: `127.0.0.1:${port}`,
    prompts,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("wiki mode sends real file contents to the summarizer even with markdown output", async () => {
  const llm = await startFakeLlm();
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-cli-llm-"));
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-cli-llm-cache-"));

  try {
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Demo\n");
    fs.writeFileSync(path.join(repoDir, "index.ts"), "export const MARKER_FROM_SOURCE = 42;\n");

    // No --json and a small repo: both used to switch file contents off for the LLM too
    const result = await runCli(
      ["wiki", repoDir, "-p", "ollama", "-m", "fake"],
      { OLLAMA_HOST: llm.host, CARTOGRAPH_CACHE_DIR: cacheDir },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stderr, /Summarized 2 files/);

    const summarizePrompts = llm.prompts.filter((p) => p.startsWith("Analyze this source file"));
    assert.equal(summarizePrompts.length, 2);
    assert.ok(
      summarizePrompts.some((p) => p.includes("MARKER_FROM_SOURCE")),
      "the summarizer prompt should contain the file's source",
    );
  } finally {
    await llm.close();
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test("a bad provider fails before any clone is attempted", async () => {
  const result = await runCli(["wiki", "https://github.com/example/does-not-exist", "-p", "bogus"]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown provider "bogus"/);
  assert.doesNotMatch(result.stderr, /Cloning/);
});
