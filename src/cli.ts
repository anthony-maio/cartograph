import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import ora from "ora";
import chalk from "chalk";
import { PROVIDERS, type ProviderId, type LLMConfig } from "./schema";
import { cloneRepo, cleanupRepo, analyzeFiles, getFileContent } from "./analyzer";
import { summarizeFiles, synthesizeWiki, selectContext } from "./pipeline";
import { wikiToMarkdown, contextToMarkdown, staticToMarkdown } from "./markdown";
import { createRunWorkspace, getCacheRoot, findRunDirectory, loadRunManifest } from "./app/cache";
import { exportRunArtifact, writeRunArtifact } from "./app/artifacts";
import { estimateContextTokens, hydrateContextFiles } from "./app/context";
import { handleInstallCommand } from "./app/commands/install";
import { handleUninstallCommand } from "./app/commands/uninstall";
import { handleDoctorCommand } from "./app/commands/doctor";

const program = new Command();

program.enablePositionalOptions();

program
  .name("cartograph")
  .description("Generate intelligent wiki documentation from any Git repo. Targeted context for LLMs — only the files that matter.")
  .version("1.0.1")
  .argument("[repo]", "GitHub URL or local directory path")
  .option("-p, --provider <provider>", "LLM provider: gemini, openai, openrouter, ollama", "gemini")
  .option("-k, --key <key>", "API key (or set CARTOGRAPH_API_KEY env var)")
  .option("-o, --output <path>", "Output file path (default: stdout)")
  .option("--json", "Output raw JSON instead of markdown")
  .option("-c, --context <task>", "Context selection mode: describe the task to get only relevant files")
  .option("-n, --top <number>", "Number of top files to include in static mode", "30")
  .option("-m, --model <model>", "Override model for both fast and strong passes (e.g. qwen3:14b)")
  .option("-s, --static", "Static analysis only — no LLM calls, no API key needed. Outputs scored files + contents.")
  .action((repo, opts) => {
    if (!repo) {
      program.outputHelp();
      return;
    }

    return run(repo, opts);
  });

addAnalysisOptions(
  program
    .command("analyze <repo>")
    .description("Analyze a repository and return ranked files and dependency data."),
).action((repo, opts) => run(repo, { ...opts, command: "analyze" }));

addAnalysisOptions(
  program
    .command("wiki <repo>")
    .description("Generate a repository wiki or static markdown summary."),
).action((repo, opts) => run(repo, { ...opts, command: "wiki" }));

addAnalysisOptions(
  program
    .command("context <repo>")
    .description("Select the minimal context needed for a specific development task.")
    .requiredOption("-t, --task <task>", "Task description used for context selection"),
).action((repo, opts) => {
  return run(repo, {
    provider: opts.provider,
    key: opts.key,
    output: opts.output,
    json: opts.json,
    context: opts.task,
    model: opts.model,
    static: opts.static,
    top: opts.top,
    command: "context",
  });
});

program
  .command("export <runId>")
  .description("Export cached run artifacts to an explicit destination path.")
  .requiredOption("--to <path>", "Destination path for the exported artifact")
  .option("-a, --artifact <name>", "Artifact name to export when the run contains multiple artifacts")
  .action(handleExportCommand);

program
  .command("install [target]")
  .description("Install Cartograph assets for a supported host.")
  .action(handleInstallCommand);

program
  .command("uninstall [target]")
  .description("Remove Cartograph assets for a supported host.")
  .action(handleUninstallCommand);

program
  .command("doctor [target]")
  .description("Inspect Cartograph installation health and host integration status.")
  .option("--json", "Output machine-readable JSON")
  .action(handleDoctorCommand);

program
  .command("mcp")
  .description("Run Cartograph in MCP server mode.")
  .action(async () => {
    await import("./mcp");
  });

program.parse();

function addAnalysisOptions<T extends Command>(command: T): T {
  return command
    .option("-p, --provider <provider>", "LLM provider: gemini, openai, openrouter, ollama", "gemini")
    .option("-k, --key <key>", "API key (or set CARTOGRAPH_API_KEY env var)")
    .option("-o, --output <path>", "Output file path (default: stdout)")
    .option("--json", "Output raw JSON instead of markdown")
    .option("-n, --top <number>", "Number of top files to include in static mode", "30")
    .option("-m, --model <model>", "Override model for both fast and strong passes (e.g. qwen3:14b)")
    .option("-s, --static", "Static analysis only — no LLM calls, no API key needed. Outputs scored files + contents.");
}

function handleExportCommand(runId: string, opts: { artifact?: string; to: string }) {
  try {
    const runDir = findRunDirectory(runId, getCacheRoot());
    if (!runDir) {
      throw new Error(`Run '${runId}' was not found in the Cartograph cache.`);
    }

    let artifactName = opts.artifact;
    if (!artifactName) {
      const manifest = loadRunManifest(runDir);
      const artifactNames = Object.keys(manifest.artifacts);
      if (artifactNames.length !== 1) {
        throw new Error("Export requires --artifact when the run has multiple artifacts.");
      }

      artifactName = artifactNames[0];
    }

    const exportedPath = exportRunArtifact(runDir, artifactName, opts.to);
    console.error(chalk.green(`Exported '${artifactName}' to ${exportedPath}`));
  } catch (err: any) {
    console.error(chalk.red(err.message || String(err)));
    process.exit(1);
  }
}

async function run(repo: string, opts: {
  provider: string;
  key?: string;
  output?: string;
  json?: boolean;
  context?: string;
  model?: string;
  static?: boolean;
  top?: string;
  command?: "analyze" | "context" | "wiki";
}) {
  // Determine if repo is local or remote
  const isLocal = fs.existsSync(repo);
  let repoDir: string;
  let needsCleanup = false;
  const topN = parseInt(opts.top || "30", 10);

  const spinner = ora();

  try {
    // === Clone or use local ===
    if (isLocal) {
      repoDir = path.resolve(repo);
      spinner.succeed(`Using local repo: ${repoDir}`);
    } else {
      spinner.start("Cloning repository...");
      let url = repo.trim();
      if (url.includes("github.com") && !url.endsWith(".git")) {
        url = url.replace(/\/$/, "") + ".git";
      }
      repoDir = await cloneRepo(url);
      needsCleanup = true;
      spinner.succeed("Cloned repository");
    }

    // === Static Analysis ===
    spinner.start("Analyzing file structure and dependencies...");
    const { files, edges } = analyzeFiles(repoDir);
    spinner.succeed(`Found ${files.length} files, ${edges.length} dependency edges`);

    // Derive repo name
    const repoName = isLocal
      ? path.basename(path.resolve(repo))
      : repo.split("/").slice(-2).join("/").replace(".git", "").replace(/\/$/, "");
    const repoId = isLocal ? repoDir : repo;
    const commandName = opts.command ?? (opts.context ? "context" : opts.static ? "analyze" : "wiki");

    // Read file contents for top files
    const topFiles = files.slice(0, topN);
    const fileContents = new Map<string, string>();
    for (const file of topFiles) {
      const content = getFileContent(repoDir, file.path, 200);
      if (content) fileContents.set(file.path, content);
    }

    // === Static-only mode: no LLM, no API key ===
    if (opts.static) {
      const output = opts.json
        ? JSON.stringify({ repoName, files, edges, fileContents: Object.fromEntries(fileContents) }, null, 2)
        : staticToMarkdown(repoName, files, edges, fileContents);

      writeOutput(output, opts.output);
      cacheRunOutput(repoId, commandName, "analysis", opts.json ? "json" : "md", output);
      return;
    }

    // === LLM modes require an API key (except Ollama) ===
    const provider = opts.provider as ProviderId;
    if (!PROVIDERS[provider]) {
      console.error(chalk.red(`Error: Unknown provider "${provider}". Use: gemini, openai, openrouter, ollama`));
      process.exit(1);
    }

    const apiKey = opts.key || process.env.CARTOGRAPH_API_KEY || (provider === "ollama" ? "ollama" : "");
    if (!apiKey) {
      console.error(chalk.red("Error: API key required. Use --key, set CARTOGRAPH_API_KEY, use -p ollama for local, or --static for no-LLM mode."));
      process.exit(1);
    }

    const providerConfig = PROVIDERS[provider];
    const config: LLMConfig = {
      apiKey,
      provider,
      fastModel: opts.model || providerConfig.defaultFastModel,
      strongModel: opts.model || providerConfig.defaultStrongModel,
    };

    // === Summarize ===
    spinner.start(`Summarizing top ${topFiles.length} files via ${providerConfig.name} (${config.fastModel})...`);
    const summaries = await summarizeFiles(config, files, fileContents, (completed, total) => {
      spinner.text = `Summarizing files: ${completed}/${total}...`;
    });
    spinner.succeed(`Summarized ${summaries.length} files`);

    // === Context Selection Mode ===
    if (opts.context) {
      spinner.start("Synthesizing architecture (needed for context selection)...");
      const wiki = await synthesizeWiki(config, repoName, files, summaries, edges);
      spinner.succeed("Architecture synthesized");

      spinner.start(`Selecting files for: "${opts.context}"...`);
      const result = await selectContext(config, opts.context, wiki, summaries, fileContents);
      const hydratedFiles = hydrateContextFiles(repoDir, result.files, fileContents);
      const totalTokens = estimateContextTokens(hydratedFiles);
      spinner.succeed(`Selected ${hydratedFiles.length} files (~${totalTokens.toLocaleString()} tokens)`);

      const output = opts.json
        ? JSON.stringify({ files: hydratedFiles, totalTokens }, null, 2)
        : contextToMarkdown(opts.context, hydratedFiles, totalTokens);

      writeOutput(output, opts.output);
      cacheRunOutput(repoId, commandName, "task-context", opts.json ? "json" : "md", output);
      return;
    }

    // === Full Synthesis ===
    spinner.start(`Synthesizing architecture via ${providerConfig.name} (${config.strongModel})...`);
    const wiki = await synthesizeWiki(config, repoName, files, summaries, edges);
    spinner.succeed("Architecture synthesized");

    const output = opts.json
      ? JSON.stringify({ wiki, fileAnalysis: files, fileSummaries: summaries, dependencyEdges: edges }, null, 2)
      : wikiToMarkdown(wiki);

    writeOutput(output, opts.output);
    cacheRunOutput(repoId, commandName, "wiki", opts.json ? "json" : "md", output);

  } catch (err: any) {
    spinner.fail(chalk.red(err.message || String(err)));
    process.exit(1);
  } finally {
    if (needsCleanup && repoDir!) {
      cleanupRepo(repoDir!);
    }
  }
}

function writeOutput(content: string, outputPath?: string) {
  if (outputPath) {
    fs.writeFileSync(outputPath, content, "utf-8");
    console.error(chalk.green(`Written to ${outputPath}`));
  } else {
    process.stdout.write(content);
  }
}

function cacheRunOutput(
  repo: string,
  command: "analyze" | "context" | "wiki",
  artifactName: string,
  extension: "json" | "md",
  content: string,
) {
  const workspace = createRunWorkspace({ repo, command });
  writeRunArtifact(workspace.runDir, {
    name: artifactName,
    extension,
    content,
  });
  console.error(chalk.gray(`Cached run ${workspace.runId} in ${workspace.runDir}`));
}
