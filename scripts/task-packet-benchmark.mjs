import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "benchmarks", "task-packets", "manifest.json");
const defaultOutputDir = path.join(repoRoot, "benchmarks", "task-packets", "output");

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadManifest();
  const selectedCases = selectCases(manifest.cases, args.caseIds);

  if (args.list) {
    printCases(selectedCases);
    return;
  }

  if (selectedCases.length === 0) {
    throw new Error("No benchmark cases matched the provided --case filters.");
  }

  const outputDir = path.resolve(args.outputDir ?? defaultOutputDir);
  const commands = selectedCases.map((entry) => ({
    entry,
    outputPath: path.join(outputDir, `${entry.id}.json`),
    args: buildCartographArgs(entry, outputDir),
  }));

  if (args.dryRun) {
    for (const command of commands) {
      console.log(renderCommand(command.args));
      console.log(`  -> ${command.outputPath}`);
    }
    return;
  }

  const cliPath = path.join(repoRoot, "dist", "cli.cjs");
  if (!fs.existsSync(cliPath)) {
    throw new Error("dist/cli.cjs was not found. Run `npm run build` before executing the benchmark.");
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const results = [];
  for (const command of commands) {
    console.error(`Running ${command.entry.id}...`);
    const result = spawnSync(process.execPath, command.args, {
      cwd: repoRoot,
      encoding: "utf-8",
    });

    if (result.status !== 0) {
      process.stderr.write(result.stderr);
      process.stdout.write(result.stdout);
      process.exit(result.status ?? 1);
    }

    results.push({
      id: command.entry.id,
      repo: command.entry.repo,
      packetType: command.entry.packetType,
      outputPath: command.outputPath,
    });
    console.log(`${command.entry.id} -> ${command.outputPath}`);
  }

  fs.writeFileSync(
    path.join(outputDir, "index.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        cases: results,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

function parseArgs(argv) {
  const parsed = {
    list: false,
    dryRun: false,
    caseIds: [],
    outputDir: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case "--list":
        parsed.list = true;
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--case":
        parsed.caseIds.push(argv[index + 1]);
        index += 1;
        break;
      case "--output":
        parsed.outputDir = argv[index + 1];
        index += 1;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`task-packet-benchmark

Usage:
  node scripts/task-packet-benchmark.mjs --list
  node scripts/task-packet-benchmark.mjs --case llama-cpp-bug-fix --dry-run
  node scripts/task-packet-benchmark.mjs --output benchmarks/task-packets/output
`);
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}

function selectCases(entries, caseIds) {
  if (!caseIds || caseIds.length === 0) {
    return entries;
  }

  const wanted = new Set(caseIds);
  return entries.filter((entry) => wanted.has(entry.id));
}

function printCases(entries) {
  for (const entry of entries) {
    console.log(`${entry.id} | ${entry.packetType} | ${entry.repo}`);
  }
}

function buildCartographArgs(entry, outputDir) {
  const outputPath = path.join(outputDir, `${entry.id}.json`);
  const args = [
    path.join("dist", "cli.cjs"),
    "packet",
    entry.repo,
    "--type",
    entry.packetType,
    "--task",
    entry.task,
    "--output",
    outputPath,
  ];

  if (entry.changedFiles?.length) {
    args.push("--changed", ...entry.changedFiles);
  }

  return args;
}

function renderCommand(args) {
  return [process.execPath, ...args].join(" ");
}

main();
