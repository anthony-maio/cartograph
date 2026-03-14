import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8"));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-pack-smoke-"));
const installRoot = path.join(tempRoot, "install-root");
const cacheRoot = path.join(tempRoot, "cache");
let tarballPath;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function quoteForWindowsShell(token) {
  const value = String(token);

  if (/^[A-Za-z0-9_./:=+\\-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function runNpm(args, options = {}) {
  if (process.platform === "win32") {
    const commandLine = `npm ${args.map(quoteForWindowsShell).join(" ")}`;

    return execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
  }

  return run("npm", args, options);
}

try {
  fs.mkdirSync(installRoot, { recursive: true });

  const packOutput = runNpm(["pack", "--json"]);
  const parsedPackOutput = JSON.parse(packOutput);
  const tarballName = parsedPackOutput[0]?.filename;
  assert.equal(typeof tarballName, "string", "npm pack should return a tarball filename");

  tarballPath = path.join(repoRoot, tarballName);

  runNpm(["init", "-y"], {
    cwd: installRoot,
  });

  runNpm(["install", tarballPath], {
    cwd: installRoot,
  });

  const installedCli = path.join(
    installRoot,
    "node_modules",
    packageJson.name,
    "dist",
    "cli.cjs",
  );

  assert.ok(fs.existsSync(installedCli), "installed package should include the bundled CLI");

  const analyzeOutput = execFileSync(process.execPath, [
    installedCli,
    "analyze",
    repoRoot,
    "--static",
    "--json",
  ], {
    cwd: installRoot,
    encoding: "utf-8",
    env: {
      ...process.env,
      CARTOGRAPH_CACHE_DIR: cacheRoot,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const analysis = JSON.parse(analyzeOutput);

  assert.equal(analysis.repoName, path.basename(repoRoot));
  assert.ok(Array.isArray(analysis.files) && analysis.files.length > 0, "analysis should include ranked files");
} finally {
  if (tarballPath) {
    fs.rmSync(tarballPath, { force: true });
  }

  fs.rmSync(tempRoot, { recursive: true, force: true });
}
