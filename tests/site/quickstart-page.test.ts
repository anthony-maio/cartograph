import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("quickstart site includes the core install and usage path", () => {
  const indexPath = path.join(repoRoot, "site", "index.html");
  const stylePath = path.join(repoRoot, "site", "style.css");
  const privacyPath = path.join(repoRoot, "site", "privacy.html");
  const launchPath = path.join(repoRoot, "site", "launch", "index.html");
  const launchAssetsIndexPath = path.join(repoRoot, "site", "launch", "assets", "index.html");
  const launchAssetsCssPath = path.join(repoRoot, "site", "launch", "assets", "assets.css");
  const launchThumbnailPath = path.join(repoRoot, "site", "launch", "assets", "thumbnail.png");
  const launchGalleryProblemPath = path.join(repoRoot, "site", "launch", "assets", "gallery-01-problem.png");
  const launchGalleryWorkflowPath = path.join(repoRoot, "site", "launch", "assets", "gallery-02-workflow.png");
  const launchGalleryAnalyzePath = path.join(repoRoot, "site", "launch", "assets", "gallery-03-analyze.png");
  const launchGalleryPacketPath = path.join(repoRoot, "site", "launch", "assets", "gallery-04-packet.png");
  const launchGalleryProofPath = path.join(repoRoot, "site", "launch", "assets", "gallery-05-proof.png");
  const launchGalleryDistributionPath = path.join(repoRoot, "site", "launch", "assets", "gallery-06-distribution.png");
  const examplesIndexPath = path.join(repoRoot, "site", "examples", "index.html");
  const benchmarksPath = path.join(repoRoot, "site", "examples", "benchmarks.html");
  const launchKitPath = path.join(repoRoot, "docs", "launch", "product-hunt-launch-kit.md");
  const packetMarkdownPath = path.join(repoRoot, "site", "examples", "llama-cpp-task-packet.md");
  const packetJsonPath = path.join(repoRoot, "site", "examples", "llama-cpp-task-packet.json");
  const deepwikiPath = path.join(repoRoot, "site", "examples", "llama-cpp-deepwiki.md");
  const llamaBenchmarkPath = path.join(repoRoot, "site", "examples", "benchmark-llama-cpp-bug-fix.json");
  const fastapiBenchmarkPath = path.join(repoRoot, "site", "examples", "benchmark-fastapi-bug-fix.json");
  const nextjsBenchmarkPath = path.join(repoRoot, "site", "examples", "benchmark-nextjs-trace-flow.json");
  const openWebUiBenchmarkPath = path.join(repoRoot, "site", "examples", "benchmark-open-webui-task.json");

  assert.ok(fs.existsSync(indexPath), "site/index.html should exist");
  assert.ok(fs.existsSync(stylePath), "site/style.css should exist");
  assert.ok(fs.existsSync(privacyPath), "site/privacy.html should exist");
  assert.ok(fs.existsSync(launchPath), "site/launch/index.html should exist");
  assert.ok(fs.existsSync(launchAssetsIndexPath), "site/launch/assets/index.html should exist");
  assert.ok(fs.existsSync(launchAssetsCssPath), "site/launch/assets/assets.css should exist");
  assert.ok(fs.existsSync(launchThumbnailPath), "site/launch/assets/thumbnail.png should exist");
  assert.ok(fs.existsSync(launchGalleryProblemPath), "site/launch/assets/gallery-01-problem.png should exist");
  assert.ok(fs.existsSync(launchGalleryWorkflowPath), "site/launch/assets/gallery-02-workflow.png should exist");
  assert.ok(fs.existsSync(launchGalleryAnalyzePath), "site/launch/assets/gallery-03-analyze.png should exist");
  assert.ok(fs.existsSync(launchGalleryPacketPath), "site/launch/assets/gallery-04-packet.png should exist");
  assert.ok(fs.existsSync(launchGalleryProofPath), "site/launch/assets/gallery-05-proof.png should exist");
  assert.ok(fs.existsSync(launchGalleryDistributionPath), "site/launch/assets/gallery-06-distribution.png should exist");
  assert.ok(fs.existsSync(examplesIndexPath), "site/examples/index.html should exist");
  assert.ok(fs.existsSync(benchmarksPath), "site/examples/benchmarks.html should exist");
  assert.ok(fs.existsSync(launchKitPath), "docs/launch/product-hunt-launch-kit.md should exist");
  assert.ok(fs.existsSync(packetMarkdownPath), "site/examples/llama-cpp-task-packet.md should exist");
  assert.ok(fs.existsSync(packetJsonPath), "site/examples/llama-cpp-task-packet.json should exist");
  assert.ok(fs.existsSync(deepwikiPath), "site/examples/llama-cpp-deepwiki.md should exist");
  assert.ok(fs.existsSync(llamaBenchmarkPath), "site/examples/benchmark-llama-cpp-bug-fix.json should exist");
  assert.ok(fs.existsSync(fastapiBenchmarkPath), "site/examples/benchmark-fastapi-bug-fix.json should exist");
  assert.ok(fs.existsSync(nextjsBenchmarkPath), "site/examples/benchmark-nextjs-trace-flow.json should exist");
  assert.ok(fs.existsSync(openWebUiBenchmarkPath), "site/examples/benchmark-open-webui-task.json should exist");

  const html = fs.readFileSync(indexPath, "utf-8");
  const privacyHtml = fs.readFileSync(privacyPath, "utf-8");
  const launchHtml = fs.readFileSync(launchPath, "utf-8");
  const launchAssetsHtml = fs.readFileSync(launchAssetsIndexPath, "utf-8");
  const launchKit = fs.readFileSync(launchKitPath, "utf-8");
  const examplesHtml = fs.readFileSync(examplesIndexPath, "utf-8");
  const benchmarksHtml = fs.readFileSync(benchmarksPath, "utf-8");

  for (const fragment of [
    "@anthony-maio/cartograph",
    "cartograph analyze",
    "cartograph packet",
    "cartograph context",
    "/plugin marketplace add anthony-maio/cartograph",
    "/plugin install cartograph@making-minds-tools",
    "cartograph install claude",
    "cartograph install openclaw",
    "cartograph install mcp",
    "build_task_packet",
    "shared dependency hubs",
    "io.github.anthony-maio/cartograph",
    "registry.modelcontextprotocol.io",
    "launch/index.html",
    "examples/index.html",
    "examples/benchmarks.html",
    "examples/llama-cpp-task-packet.md",
    "examples/llama-cpp-deepwiki.md",
    "use-cartograph",
    "repo-surveyor",
    "benchmark:task-packets",
    "llama.cpp task packet",
    "DeepWiki-style brief",
    "5-minute quickstart",
    "privacy.html",
    "Analyze",
    "Packet",
    "Context",
  ]) {
    assert.match(html, new RegExp(escapeForRegExp(fragment), "i"));
  }

  for (const fragment of [
    "Sample artifacts",
    "Open benchmark scorecards",
    "Open markdown packet",
    "Open JSON packet",
    "DeepWiki-style summary",
    "llama.cpp",
  ]) {
    assert.match(examplesHtml, new RegExp(escapeForRegExp(fragment), "i"));
  }

  for (const fragment of [
    "Product Hunt launch surface",
    "Turn any repo into task-shaped context for coding agents",
    "Analyze -> Packet -> Context",
    "Product Hunt submission",
    "Maker first comment",
    "Gallery storyboard",
    "Install with npm",
    "Benchmark proof",
    "llama.cpp",
    "Claude Code",
    "OpenClaw",
    "assets/index.html",
  ]) {
    assert.match(launchHtml, new RegExp(escapeForRegExp(fragment), "i"));
  }

  for (const fragment of [
    "Cartograph Product Hunt asset kit",
    "thumbnail.png",
    "gallery-01-problem.png",
    "gallery-06-distribution.png",
  ]) {
    assert.match(launchAssetsHtml, new RegExp(escapeForRegExp(fragment), "i"));
  }

  for (const fragment of [
    "Product Hunt Launch Kit",
    "Primary submission URL",
    "Tagline",
    "Maker first comment",
    "Gallery storyboard",
    "Asset checklist",
    "thumbnail.png",
    "render-launch-assets.mjs",
  ]) {
    assert.match(launchKit, new RegExp(escapeForRegExp(fragment), "i"));
  }

  for (const fragment of [
    "Benchmark proof",
    "llama.cpp",
    "fastapi",
    "next.js",
    "open-webui",
    "Open benchmark JSON",
  ]) {
    assert.match(benchmarksHtml, new RegExp(escapeForRegExp(fragment), "i"));
  }

  for (const fragment of [
    "Cartograph Privacy Policy",
    "does not send usage telemetry",
    "Gemini",
    "OpenAI",
    "OpenRouter",
    "anthony@making-minds.ai",
  ]) {
    assert.match(privacyHtml, new RegExp(escapeForRegExp(fragment), "i"));
  }
});

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
