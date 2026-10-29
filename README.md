# Cartograph

Cartograph provides task-focused repository context for coding agents. It ships a CLI, an MCP server, install adapters for Claude Code, OpenClaw, and Hermes, and agent assets for documentation workflows.

- npm: [`@anthony-maio/cartograph`](https://www.npmjs.com/package/@anthony-maio/cartograph)
- MCP Registry: [`io.github.anthony-maio/cartograph`](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.anthony-maio/cartograph)
- Quickstart: [`cartograph.making-minds.ai`](https://cartograph.making-minds.ai)

Instead of dumping an entire repository into context, Cartograph ranks the files that matter, maps dependencies, caches structured artifacts, and lets the next tool or agent pick up from those artifacts.

The primary workflow is:

1. `analyze` to map the repo
2. `packet` to prepare the work
3. `context --static` to load task-matched files without a model call

`wiki`, host installs, and benchmarks are secondary surfaces built around that core path.

## Install

```bash
npm install
npm run build
```

For global use from npm:

```bash
npm install -g @anthony-maio/cartograph
```

For MCP host discovery via the official registry:

- `io.github.anthony-maio/cartograph`
- [Registry listing](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.anthony-maio/cartograph)

For Claude Code plugin install from this public repo:

```text
/plugin marketplace add anthony-maio/cartograph
/plugin install cartograph@making-minds-tools
```

For global use from a local checkout:

```bash
npm install -g .
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow and [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## Run a complete example

The npm package includes a small refresh-token example. From a new working directory:

```sh
npm init -y
npm install @anthony-maio/cartograph@1.3.0
npx cartograph analyze ./node_modules/@anthony-maio/cartograph/examples/auth-refresh --static
npx cartograph packet ./node_modules/@anthony-maio/cartograph/examples/auth-refresh --type bug-fix --task "fix refresh token expiry"
npx cartograph context ./node_modules/@anthony-maio/cartograph/examples/auth-refresh --task "fix refresh token expiry" --static --json
node --test ./node_modules/@anthony-maio/cartograph/examples/auth-refresh/tests/auth-refresh.test.js
```

The packet should point to `src/auth/refresh.js` and `tests/auth-refresh.test.js`. The context bundle includes the clock helper and leaves unrelated billing/catalog files out. The three behavioral checks should pass. [Walk through the investigation](docs/examples/auth-refresh.md) for expected results and how to apply the same process to your repository.

## Hermes plugin

The native Hermes plugin exposes `cartograph_analyze` for repository orientation and `cartograph_context` for task-focused source excerpts. Both run locally in static mode without a model API call. Install the npm package and its included adapter:

```sh
npm install -g @anthony-maio/cartograph@1.3.0
cartograph install hermes
hermes plugins enable cartograph
cartograph doctor hermes
```

Run these commands in the same OS environment as Hermes. For Hermes in WSL, use WSL Node and repository paths such as `/mnt/d/Development/cartograph`. Restart an existing Hermes session to load the tools. The installer binds the plugin to the installed CLI; rerun the install command after moving the package or changing Node.

See the [Hermes setup and real-repository example](docs/examples/hermes.md) for profile settings, verification, and removal. The plugin caches source excerpts under the selected Hermes profile and supports an optional repository allowlist. Static matching can miss relevant code, so check the returned source before editing.

For a Hermes-managed plugin checkout, see the [standalone plugin guide](assets/hermes/README.md)
and the [commit-pinned installation option](docs/examples/hermes.md#optional-let-hermes-manage-the-plugin-checkout).

## Claude Code Plugin

This repo also acts as a Claude Code plugin marketplace. The `cartograph` plugin bundles:

- a plugin-scoped Cartograph MCP server
- slash commands: `/cartograph:analyze`, `/cartograph:context`, `/cartograph:wiki`
- the `use-cartograph` and `repo-surveyor` skills
- the documentation-agent bundle: `repo-scout`, `dependency-tracer`, `context-picker`, `api-surface-writer`, and `wiki-writer`

Install it with:

```text
/plugin marketplace add anthony-maio/cartograph
/plugin install cartograph@making-minds-tools
```

## Primary Workflow

If you only remember one thing, remember this:

```bash
cartograph analyze <repo> --static
cartograph packet <repo> --type <type> --task "<task>"
cartograph context <repo> --task "<task>" --static --json
```

- `analyze` maps the repo and tells you what matters.
- `packet` turns a concrete job into a reusable working artifact.
- `context --static` selects task-matched files and their nearby dependencies and tests, with their contents. It uses local heuristics and needs no API key.

The separate model-backed context workflow runs when you omit `--static`; configure a provider before using it. Neither mode proves that a selected file contains the bug.

## Command Surface

```bash
cartograph analyze <repo> [options]
cartograph packet <repo> --type <type> --task "<task>" [--changed <paths...>]
cartograph context <repo> --task "<task>" [options]
cartograph wiki <repo> [options]
cartograph export <run-id> --to <path> [--artifact <name>]
cartograph install <claude|openclaw|mcp|hermes>
cartograph uninstall <claude|openclaw|mcp|hermes>
cartograph doctor [target] [--json]
cartograph mcp
```

Legacy compatibility still works:

```bash
cartograph <repo> --static
cartograph <repo> -c "trace auth flow"
```

## CLI Usage

```bash
# Map the repo
cartograph analyze ./my-project --static

# Prepare a concrete job
cartograph packet ./my-project --type bug-fix --task "fix auth refresh bug" --changed src/auth/service.ts tests/auth/service.test.ts

# Load the minimum file set for that job
cartograph context ./my-project --task "add user authentication" --static --json

# Force embedded snippets when you really want them
cartograph analyze ./my-project --static --json --include-contents

# Full wiki output
cartograph wiki ./my-project -p gemini -k $CARTOGRAPH_API_KEY -o wiki.md

# Export a cached artifact to an explicit path
cartograph export run-abc123 --to ./artifacts/wiki.md

# Run the MCP server directly
cartograph mcp
```

For small repos, `analyze --static --json` now defaults to compact output instead of embedding top-file contents. That keeps tiny repos readable and lets direct file reads stay cheaper than a giant JSON blob. Use `--include-contents` when you explicitly want embedded snippets.

The default markdown output from `analyze --static` is human-first: it highlights what matters, surfaces dependency hubs, and recommends the next commands instead of dumping raw file contents immediately.

### Providers

- `gemini`
- `openai`
- `openrouter`
- `ollama`

Set the API key with `--key` or `CARTOGRAPH_API_KEY`. Ollama does not require a key.

## Cache Model

Cartograph writes successful runs into the user cache by default:

- Windows: `%USERPROFILE%\\.cartograph\\cache`
- POSIX: `~/.cartograph/cache`

Each run gets a manifest plus named artifacts, which keeps agent handoffs lightweight and makes `cartograph export` deterministic.

## Host Installs

Installing the package does not modify host configuration. Use the host-specific installer to copy its assets, then enable the integration in that host.

```bash
cartograph install claude
cartograph install openclaw
cartograph install mcp
cartograph install hermes
```

What each target installs:

- `claude`: user-scope skills plus the bundled documentation agents under `~/.claude`
- `openclaw`: user-scope skill pack under `~/.openclaw`
- `mcp`: a Cartograph MCP config snippet under `~/.cartograph/mcp`
- `hermes`: a native tool plugin and local runtime binding under the selected Hermes profile; enable it with `hermes plugins enable cartograph`

Check status at any time:

```bash
cartograph doctor
cartograph doctor --json
```

## Choose Your Surface

- CLI: best default path when you want deterministic local analysis and explicit artifacts.
- Claude Code plugin: best when you want plugin install, bundled skills, slash commands, and a plugin-scoped MCP server.
- OpenClaw skills: best when you want the same Cartograph workflow inside an OpenClaw skill-first environment.
- Hermes plugin: native repository orientation and source-context tools backed by the local CLI.
- MCP Registry: best when your host already prefers tool wiring over shell commands.

## MCP Server

Cartograph's MCP server exposes static repo analysis directly to hosts that prefer MCP over shell commands.

Tools:

- `analyze_repo`: score files, map dependencies, and return compact analysis output or embedded top-file contents for a local repo or GitHub URL
- `get_file_contents`: fetch full contents for specific files after analysis
- `build_task_packet`: return a typed task packet with key files, dependency hubs, validation targets, risks, and task-specific details

Bug-fix packets are tuned to stay focused when you provide `--changed` or `changed_files`: they keep explicit change surfaces in view, prefer exact validation targets, and bias toward shared dependencies over peripheral utility scripts.

If you want Cartograph's packaged MCP snippet, run:

```bash
cartograph install mcp
```

That writes a reusable config file that points at:

```json
{
  "mcpServers": {
    "cartograph": {
      "command": "cartograph",
      "args": ["mcp"]
    }
  }
}
```

## MCP Registry

Cartograph is published in the official MCP Registry with the server name `io.github.anthony-maio/cartograph`.

- [View the registry entry](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.anthony-maio/cartograph)

Repo-side metadata lives in:

- [`package.json`](./package.json) via the `mcpName` field
- [`server.json`](./server.json) for registry metadata

The current install artifact published to npm is:

- `@anthony-maio/cartograph`

For repeatable registry releases, this repo also includes a GitHub Actions workflow at
[`publish-mcp.yml`](./.github/workflows/publish-mcp.yml). It is set up for npm trusted publishing on
GitHub Actions, then authenticates to the MCP Registry with GitHub OIDC and publishes `server.json`.

## Packaged Agent Assets

The package currently ships:

- two Claude skills: `use-cartograph` and `repo-surveyor`
- five Claude documentation agents: `repo-scout`, `dependency-tracer`, `context-picker`, `api-surface-writer`, and `wiki-writer`
- two OpenClaw skills: `use-cartograph` and `repo-surveyor`
- bundled OpenProse templates inside both OpenClaw skills for repo-doc and task-context workflows

Skill roles:

- `use-cartograph`: tool-first path when the CLI or MCP server is available
- `repo-surveyor`: manual fallback path when Cartograph is unavailable or needs verification

Both skills are designed to produce the same downstream contract:

- key files
- dependency hubs
- minimal task context
- doc-ready summary

These assets are meant to pass run IDs and artifact paths between steps instead of copying large prose into the main context.

The Claude plugin marketplace in this repo ships the same skills and agents, plus plugin-first slash commands and a bundled Cartograph MCP server.

## Task Packet Benchmark

This repo includes a public benchmark pack for task packets under [`benchmarks/task-packets`](./benchmarks/task-packets).

Use it to compare packet quality across large visible repos with a stable set of task prompts:

```bash
npm run benchmark:task-packets -- --list
npm run benchmark:task-packets -- --case llama-cpp-bug-fix --dry-run
```

The benchmark runner writes packet artifacts to `benchmarks/task-packets/output/`, which is gitignored.

Curated scorecards and public artifact links are also published on the site:

- [`cartograph.making-minds.ai/examples/benchmarks.html`](https://cartograph.making-minds.ai/examples/benchmarks.html)

## Example Artifacts

Tracked examples live under [`docs/examples`](./docs/examples):

- [`llama-cpp-task-packet.md`](./docs/examples/llama-cpp-task-packet.md)
- [`llama-cpp-task-packet.json`](./docs/examples/llama-cpp-task-packet.json)
- [`llama-cpp-deepwiki.md`](./docs/examples/llama-cpp-deepwiki.md)
- [`task-packet-benchmark-scorecards.md`](./docs/examples/task-packet-benchmark-scorecards.md)

These are useful when you want to show what a focused bug-fix packet and a curated repo brief look like on a large public codebase.

## Development

```bash
npm install
npm test
npm run check
npm run build
npm run pack:smoke
```

## License

MIT
