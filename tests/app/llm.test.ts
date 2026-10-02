import test from "node:test";
import assert from "node:assert/strict";
import { getOllamaBaseUrl, isRetryableError, LLMTimeoutError, withRetries, type LLMClient } from "../../src/llm.ts";

const noSleep = async () => {};

function flakyClient(failures: unknown[], result = "ok"): LLMClient & { calls: number } {
  const client = {
    calls: 0,
    async generate() {
      const failure = failures[client.calls++];
      if (failure) throw failure;
      return result;
    },
  };
  return client;
}

test("withRetries retries rate limits and server errors, then succeeds", async () => {
  const inner = flakyClient([{ status: 429 }, { status: 503 }]);
  const client = withRetries(inner, { retries: 3, sleep: noSleep });

  assert.equal(await client.generate("m", { prompt: "p" }), "ok");
  assert.equal(inner.calls, 3);
});

test("withRetries gives up after the retry budget", async () => {
  const inner = flakyClient([{ status: 429 }, { status: 429 }, { status: 429 }]);
  const client = withRetries(inner, { retries: 2, sleep: noSleep });

  await assert.rejects(client.generate("m", { prompt: "p" }), (err: any) => err.status === 429);
  assert.equal(inner.calls, 3);
});

test("withRetries does not retry client errors like a bad API key", async () => {
  const inner = flakyClient([{ status: 401 }]);
  const client = withRetries(inner, { retries: 3, sleep: noSleep });

  await assert.rejects(client.generate("m", { prompt: "p" }));
  assert.equal(inner.calls, 1);
});

test("withRetries times out a hung request and retries it", async () => {
  let calls = 0;
  const inner: LLMClient = {
    generate: () => (++calls === 1 ? new Promise<string>(() => {}) : Promise.resolve("recovered")),
  };
  const client = withRetries(inner, { retries: 1, timeoutMs: 20, sleep: noSleep });

  assert.equal(await client.generate("m", { prompt: "p" }), "recovered");
  assert.equal(calls, 2);
});

test("isRetryableError recognizes network and timeout failures", () => {
  assert.equal(isRetryableError({ code: "ECONNRESET" }), true);
  assert.equal(isRetryableError(new LLMTimeoutError(5)), true);
  assert.equal(isRetryableError(new Error("bad json")), false);
});

test("getOllamaBaseUrl follows OLLAMA_HOST conventions", () => {
  assert.equal(getOllamaBaseUrl({}), "http://localhost:11434/v1");
  assert.equal(getOllamaBaseUrl({ OLLAMA_HOST: "0.0.0.0" }), "http://0.0.0.0:11434/v1");
  assert.equal(getOllamaBaseUrl({ OLLAMA_HOST: "gpu-box:9000" }), "http://gpu-box:9000/v1");
  assert.equal(getOllamaBaseUrl({ OLLAMA_HOST: "https://ollama.example.com/" }), "https://ollama.example.com/v1");
});
