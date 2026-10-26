import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/run-cli.ts";
import { loadRunManifest } from "../../src/app/cache.ts";

const task = "fix refresh token expiry";

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-cli-context-"));
  const repoDir = path.join(root, "repo");
  const cacheDir = path.join(root, "cache");
  const sources = {
    "src/auth/refresh.ts": 'import { now } from "../clock";\nexport function refreshToken(expiresAt: number) { return expiresAt > now(); }\n',
    "src/clock.ts": "export const now = () => Date.now();\n",
    "tests/auth-refresh.test.ts": 'import { refreshToken } from "../src/auth/refresh";\nexport const expiredTokenIsRejected = !refreshToken(0);\n',
    "src/billing/invoice.ts": 'import { now } from "../clock";\nexport const createInvoice = () => ({ amount: 10, createdAt: now() });\n',
    "src/catalog/products.ts": 'export const listProducts = () => ["coffee"];\n',
    "tests/invoice.test.ts": 'import { createInvoice } from "../src/billing/invoice";\nexport const invoiceTotal = createInvoice().amount;\n',
  };
  for (const [relativePath, content] of Object.entries(sources)) {
    const fullPath = path.join(repoDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return {
    root,
    repoDir,
    cacheDir,
    env: { CARTOGRAPH_CACHE_DIR: cacheDir, CARTOGRAPH_API_KEY: "", OLLAMA_HOST: "127.0.0.1:1" },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function cachedRun(cacheDir: string) {
  const [repoFingerprint] = fs.readdirSync(cacheDir);
  const repoCache = path.join(cacheDir, repoFingerprint);
  const [runId] = fs.readdirSync(repoCache);
  const runDir = path.join(repoCache, runId);
  return { runDir, manifest: loadRunManifest(runDir) };
}

test("static context selects task source, dependency, and test without an API key", async () => {
  const fixture = createFixture();
  try {
    const result = await runCli([
      "context", fixture.repoDir, "--task", task, "--static", "--json",
    ], fixture.env);
    assert.equal(result.code, 0, result.stderr);
    const context = JSON.parse(result.stdout);
    const selectedPaths = context.files.map((file: { path: string }) => file.path);
    assert.deepEqual(new Set(selectedPaths), new Set([
      "src/auth/refresh.ts", "src/clock.ts", "tests/auth-refresh.test.ts",
    ]));
    assert.ok(context.files.every((file: { content: string; reason: string }) => file.content && file.reason));
    assert.equal(context.totalTokens, context.files.reduce(
      (total: number, file: { content: string }) => total + Math.ceil(file.content.length / 4), 0,
    ));
    assert.match(context.files.find((file: { path: string }) => file.path === "src/auth/refresh.ts").content, /expiresAt > now\(\)/);
    assert.equal(context.edges, undefined);
    const { runDir, manifest } = cachedRun(fixture.cacheDir);
    assert.equal(manifest.command, "context");
    assert.deepEqual(Object.keys(manifest.artifacts), ["task-context"]);
    assert.equal(fs.readFileSync(path.join(runDir, manifest.artifacts["task-context"].relativePath), "utf8"), result.stdout);
  } finally {
    fixture.cleanup();
  }
});

test("static context changes with the task and respects the requested maximum", async () => {
  const fixture = createFixture();
  try {
    const result = await runCli([
      "context", fixture.repoDir, "--task", "fix invoice amount", "--static", "--json", "--top", "1",
    ], fixture.env);
    assert.equal(result.code, 0, result.stderr);
    const context = JSON.parse(result.stdout);
    assert.equal(context.files.length, 1);
    assert.equal(context.files[0].path, "src/billing/invoice.ts");
    assert.doesNotMatch(result.stdout, /refreshToken|listProducts/);
  } finally {
    fixture.cleanup();
  }
});

test("legacy static context writes markdown and caches the task-context artifact", async () => {
  const fixture = createFixture();
  try {
    const outputPath = path.join(fixture.root, "context.md");
    const result = await runCli([
      fixture.repoDir, "--context", task, "--static", "--output", outputPath,
    ], fixture.env);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, "");
    const output = fs.readFileSync(outputPath, "utf8");
    assert.match(output, /^# Context for: fix refresh token expiry/);
    assert.match(output, /## tests\/auth-refresh\.test\.ts/);
    assert.match(output, /expiresAt > now\(\)/);
    assert.doesNotMatch(output, /invoice|products|Files by Importance/);
    const { runDir, manifest } = cachedRun(fixture.cacheDir);
    assert.equal(manifest.artifacts["task-context"].format, "md");
    assert.equal(fs.readFileSync(path.join(runDir, manifest.artifacts["task-context"].relativePath), "utf8"), output);
  } finally {
    fixture.cleanup();
  }
});

test("static context reports no matching files instead of returning unrelated source", async () => {
  const fixture = createFixture();
  try {
    const result = await runCli([
      "context", fixture.repoDir, "--task", "repair nonexistent payment-webhook", "--static", "--json",
    ], fixture.env);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { files: [], totalTokens: 0 });
    assert.match(result.stderr, /No files matched/);
  } finally {
    fixture.cleanup();
  }
});

test("context keeps its provider-backed default unless --static is requested", async () => {
  const fixture = createFixture();
  try {
    const result = await runCli([
      "context", fixture.repoDir, "--task", task, "--json",
    ], fixture.env);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /API key required/);
    assert.match(result.stderr, /--static/);
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(fixture.cacheDir), false);
  } finally {
    fixture.cleanup();
  }
});

test("invalid context limits and empty tasks fail before repository resolution", async () => {
  for (const top of ["0", "-1", "1.5", "2files", "Infinity"]) {
    const result = await runCli([
      "context", "https://github.com/example/does-not-exist", "--task", task, "--static", "--top", top,
    ]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /--top must be a positive integer/);
    assert.doesNotMatch(result.stderr, /Cloning/);
  }
  const result = await runCli([
    "context", "https://github.com/example/does-not-exist", "--task", "  ", "--static",
  ]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Task description must not be empty/);
  assert.doesNotMatch(result.stderr, /Cloning/);
});
