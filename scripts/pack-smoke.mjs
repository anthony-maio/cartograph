import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8"));
const serverJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "server.json"), "utf-8"));
const tempParent = fs.realpathSync(os.tmpdir());
const tempRoot = fs.mkdtempSync(path.join(tempParent, "cartograph-pack-smoke-"));
const stageRoot = path.join(tempRoot, "source");
const installRoot = path.join(tempRoot, "consumer");
const cacheRoot = path.join(tempRoot, "cache");
const homeRoot = path.join(tempRoot, "home");
const npmCli = process.env.npm_execpath;
const task = "fix refresh token expiry";
const relevantPaths = ["src/auth/refresh.js", "tests/auth-refresh.test.js"];
const unrelatedPaths = ["src/billing/invoice.js", "src/catalog/products.js"];

// Keep credentials and user-level npm/Cartograph configuration out of the smoke run.
const smokeEnv = Object.fromEntries(Object.entries(process.env).filter(([key, value]) =>
  value !== undefined && /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TMP|TEMP|TMPDIR)$/i.test(key),
));
Object.assign(smokeEnv, {
  HOME: homeRoot,
  USERPROFILE: homeRoot,
  APPDATA: path.join(homeRoot, "AppData", "Roaming"),
  LOCALAPPDATA: path.join(homeRoot, "AppData", "Local"),
  XDG_CONFIG_HOME: path.join(homeRoot, ".config"),
  XDG_CACHE_HOME: path.join(homeRoot, ".cache"),
  CARTOGRAPH_CACHE_DIR: cacheRoot,
  npm_config_cache: path.join(tempRoot, "npm-cache"),
  npm_config_userconfig: path.join(homeRoot, ".npmrc"),
  NO_COLOR: "1",
});

function run(command, args, cwd = installRoot) {
  try {
    return execFileSync(command, args, {
      cwd,
      env: smokeEnv,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`${command} failed: ${error.stderr || error.message}`, { cause: error });
  }
}

function runNpm(args, cwd = installRoot) {
  assert.ok(npmCli && fs.existsSync(npmCli), "Run this check with npm run pack:smoke");
  // Invoke npm's JS entry point directly so Windows needs no shell argument quoting.
  return run(process.execPath, [npmCli, ...args], cwd);
}

function assertRelevantPacket(packet) {
  assert.equal(packet.taskType, "bug-fix");
  assert.equal(packet.taskSummary, task);
  const files = packet.minimalContext.map((file) => file.path);
  for (const file of relevantPaths) {
    assert.ok(files.includes(file), `task packet should include ${file}`);
  }
  for (const file of unrelatedPaths) {
    assert.ok(!files.includes(file), `task packet should omit unrelated ${file}`);
  }
  assert.ok(packet.validationTargets.some((file) => file.path === relevantPaths[1]));
}

function assertInHome(target) {
  const relative = path.relative(homeRoot, path.resolve(target));
  assert.ok(relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative), `adapter path must stay inside the isolated home: ${target}`);
}

async function checkMcp(args, exampleRoot) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args,
    cwd: installRoot,
    env: smokeEnv,
    stderr: "pipe",
  });
  const client = new Client({ name: "cartograph-pack-smoke", version: "1.0.0" });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => { stderr += String(chunk); });
  try {
    await client.connect(transport, { timeout: 15_000 });
    assert.equal(client.getServerVersion()?.version, packageJson.version);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [
      "analyze_repo", "build_task_packet", "get_file_contents",
    ]);
    const result = await client.callTool({
      name: "build_task_packet",
      arguments: { repo: exampleRoot, type: "bug-fix", task },
    });
    assert.ok(!result.isError, JSON.stringify(result));
    const textPart = result.content.find((part) => part.type === "text");
    assert.ok(textPart, "MCP task packet should return JSON text");
    assertRelevantPacket(JSON.parse(textPart.text));
  } catch (error) {
    throw new Error(`Installed MCP server failed: ${error.message}\n${stderr}`, { cause: error });
  } finally {
    await client.close();
  }
}

try {
  for (const dir of [stageRoot, installRoot, homeRoot]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(homeRoot, ".npmrc"), "");

  // Pack sources without existing bundles. A missing prepack build must fail here,
  // even when the contributor's checkout already contains a working dist directory.
  for (const entry of [
    "package.json", "package-lock.json", "src", "assets", "examples", "scripts",
    "docs/examples", "README.md", "LICENSE", "CONTRIBUTING.md", "SECURITY.md",
  ]) {
    fs.cpSync(path.join(repoRoot, entry), path.join(stageRoot, entry), { recursive: true });
  }
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(stageRoot, "node_modules"), "junction");
  assert.ok(!fs.existsSync(path.join(stageRoot, "dist")), "staged package must start without dist");

  const [packed] = JSON.parse(runNpm(["pack", "--json", "--pack-destination", tempRoot], stageRoot));
  assert.equal(typeof packed?.filename, "string", "npm pack should return a tarball filename");
  assert.equal(path.basename(packed.filename), packed.filename, "tarball filename must stay in the temp directory");
  const packedPaths = packed.files.map((file) => file.path);
  for (const file of [
    "dist/cli.cjs", "dist/mcp.cjs", "assets/mcp/cartograph-mcp.json",
    "assets/claude/skills/use-cartograph/SKILL.md",
    "docs/examples/auth-refresh.md",
    ...relevantPaths.map((file) => `examples/auth-refresh/${file}`),
  ]) {
    assert.ok(packedPaths.includes(file), `tarball should contain ${file}`);
  }
  assert.ok(!packedPaths.some((file) => /^(src|tests|node_modules)\//.test(file)), "tarball should omit development files");

  fs.writeFileSync(path.join(installRoot, "package.json"), JSON.stringify({ name: "cartograph-smoke-consumer", private: true }));
  runNpm(["install", path.join(tempRoot, packed.filename), "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"]);
  assert.equal(runNpm(["exec", "--offline", "--", "cartograph", "--version"]).trim(), packageJson.version);

  const installedRoot = path.join(installRoot, "node_modules", packageJson.name);
  const installedCli = path.join(installedRoot, "dist", "cli.cjs");
  const installedMcp = path.join(installedRoot, "dist", "mcp.cjs");
  const exampleRoot = path.join(installedRoot, "examples", "auth-refresh");
  const cliJson = (args) => JSON.parse(run(process.execPath, [installedCli, ...args]));

  for (const adapter of ["claude", "openclaw", "mcp"]) {
    const initial = cliJson(["doctor", adapter, "--json"]).adapters[0];
    assert.equal(initial.installed, false);
    assertInHome(initial.targetRoot);
    for (const asset of initial.assets) assertInHome(asset.path);
    fs.mkdirSync(initial.targetRoot, { recursive: true });
    const unrelatedFile = path.join(initial.targetRoot, "existing-host-file.txt");
    fs.writeFileSync(unrelatedFile, "preserve existing host files");

    run(process.execPath, [installedCli, "install", adapter]);
    const installed = cliJson(["doctor", adapter, "--json"]).adapters[0];
    assert.equal(installed.installed, true, `${adapter} assets should load from the installed package`);
    assert.ok(installed.assets.every((asset) => asset.exists));
    for (const asset of installed.assets) assertInHome(fs.realpathSync(asset.path));

    run(process.execPath, [installedCli, "uninstall", adapter]);
    const removed = cliJson(["doctor", adapter, "--json"]).adapters[0];
    assert.equal(removed.installed, false);
    assert.ok(removed.assets.every((asset) => !asset.exists));
    assert.equal(fs.readFileSync(unrelatedFile, "utf-8"), "preserve existing host files");
  }

  const analysis = cliJson(["analyze", exampleRoot, "--static", "--json"]);
  assert.equal(analysis.repoName, "auth-refresh");
  for (const file of relevantPaths) assert.ok(analysis.files.some((entry) => entry.path === file));
  assertRelevantPacket(cliJson(["packet", exampleRoot, "--type", "bug-fix", "--task", task]));

  const context = cliJson(["context", exampleRoot, "--task", task, "--static", "--json"]);
  const contextPaths = context.files.map((file) => file.path);
  for (const file of relevantPaths) assert.ok(contextPaths.includes(file), `context should contain ${file}`);
  for (const file of unrelatedPaths) assert.ok(!contextPaths.includes(file), `context should omit unrelated ${file}`);
  assert.ok(context.files.every((file) => typeof file.content === "string" && file.content.trim()), "context must include usable source text");
  assert.ok(context.totalTokens > 0, "context must report an estimated token count");
  run(process.execPath, ["--test", "tests/auth-refresh.test.js"], exampleRoot);

  const registryPackage = serverJson.packages.find((entry) => entry.registryType === "npm");
  assert.equal(registryPackage?.identifier, packageJson.name);
  const registryArgs = (registryPackage.packageArguments ?? []).map((arg) => {
    assert.equal(arg.type, "positional", "smoke runner supports positional registry arguments");
    assert.equal(typeof arg.value, "string");
    return arg.value;
  });
  await checkMcp([installedCli, ...registryArgs], exampleRoot);
  await checkMcp([installedMcp], exampleRoot);

  assert.ok(fs.existsSync(cacheRoot), "CLI workflow should create artifacts in its isolated cache");
  console.log(`Packed ${packageJson.name}@${packageJson.version} from unbuilt sources.`);
  console.log(`Static context: ${contextPaths.join(", ")} (~${context.totalTokens} tokens).`);
  console.log("MCP tools: analyze_repo, build_task_packet, get_file_contents; registry and direct bundle passed.");
  console.log("Installed CLI, three host adapters, static analysis, task packet, source context, and example tests passed.");
} finally {
  // Remove the junction first so recursive cleanup cannot enter the checkout.
  const dependencyLink = path.join(stageRoot, "node_modules");
  if (fs.existsSync(dependencyLink)) fs.unlinkSync(dependencyLink);
  const resolvedTempRoot = fs.realpathSync(tempRoot);
  assert.equal(path.dirname(resolvedTempRoot), tempParent, "cleanup must stay directly beneath the system temp directory");
  assert.ok(path.basename(resolvedTempRoot).startsWith("cartograph-pack-smoke-"));
  fs.rmSync(resolvedTempRoot, { recursive: true, force: true });
}
