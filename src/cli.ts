import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import ora from "ora";
import chalk from "chalk";
import { PROVIDERS, type ProviderId, type LLMConfig } from "./schema";
import { cloneRepo, cleanupRepo, analyzeFiles, getFileContent } from "./analyzer";
import { summarizeFiles, synthesizeWiki, selectContext } from "./pipeline";
import { wikiToMarkdown, contextToMarkdown, staticToMarkdown } from "./markdown";

const program = new Command();

program
  .name("cartograph")
  .description("Generate intelligent wiki documentation from any Git repo. Targeted context for LLMs — only the files that matter.")
  .version("1.0.0")
  .argument("<repo>", "GitHub URL or local directory path")
  .option("-p, --provider <provider>", "LLM provider: gemini, openai, openrouter", "gemini")
  .option("-k, --key <key>", "API key (or set OPENCODEWIKI_API_KEY env var)")
  .option("-o, --output <path>", "Output file path (default: stdout)")
  .option("--json", "Output raw JSON instead of markdown")
  .option("-c, --context <task>", "Context selection mode: describe the task to get only relevant files")
  .option("-n, --top <number>", "Number of top files to include in static mode", "30")
  .option("-s, --static", "Static analysis only — no LLM calls, no API key needed. Outputs scored files + contents.")
  .action(run);

program.parse();

async function run(repo: string, opts: {
  provider: string;
  key?: string;
  output?: string;
  json?: boolean;
  context?: string;
  static?: boolean;
  top?: string;
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
      return;
    }

    // === LLM modes require an API key ===
    const apiKey = opts.key || process.env.CARTOGRAPH_API_KEY;
    if (!apiKey) {
      console.error(chalk.red("Error: API key required. Use --key, set CARTOGRAPH_API_KEY, or use --static for no-LLM mode."));
      process.exit(1);
    }

    const provider = opts.provider as ProviderId;
    if (!PROVIDERS[provider]) {
      console.error(chalk.red(`Error: Unknown provider "${provider}". Use: gemini, openai, openrouter`));
      process.exit(1);
    }

    const providerConfig = PROVIDERS[provider];
    const config: LLMConfig = {
      apiKey,
      provider,
      fastModel: providerConfig.defaultFastModel,
      strongModel: providerConfig.defaultStrongModel,
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
      spinner.succeed(`Selected ${result.files.length} files (~${result.totalTokens.toLocaleString()} tokens)`);

      const output = opts.json
        ? JSON.stringify(result, null, 2)
        : contextToMarkdown(opts.context, result.files, result.totalTokens);

      writeOutput(output, opts.output);
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
