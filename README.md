# Cartograph

Cartograph is a single-package repo analysis tool for coding agents. It ships a CLI, an MCP server, user-scope install adapters for Claude Code and OpenClaw, and packaged agent assets for documentation-heavy workflows.

- npm: [`@anthony-maio/cartograph`](https://www.npmjs.com/package/@anthony-maio/cartograph)
- MCP Registry: [`io.github.anthony-maio/cartograph`](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.anthony-maio/cartograph)
- Quickstart: [`cartograph.making-minds.ai`](https://cartograph.making-minds.ai)

Instead of dumping an entire repository into context, Cartograph ranks the files that matter, maps dependencies, caches structured artifacts, and lets the next tool or agent pick up from those artifacts.

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

## Command Surface

```bash
cartograph analyze <repo> [options]
cartograph packet <repo> --type <type> --task "<task>" [--changed <paths...>]
cartograph context <repo> --task "<task>" [options]
cartograph wiki <repo> [options]
cartograph export <run-id> --to <path> [--artifact <name>]
cartograph install <claude|openclaw|mcp>
cartograph uninstall <claude|openclaw|mcp>
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
# Static analysis with ranked files and dependency data
cartograph analyze ./my-project --static --json

# Task-scoped context selection
cartograph context ./my-project --task "add user authentication" --json

# Typed task packet
cartograph packet ./my-project --type bug-fix --task "fix auth refresh bug" --changed src/auth/service.ts tests/auth/service.test.ts

# Full wiki output
cartograph wiki ./my-project -p gemini -k $CARTOGRAPH_API_KEY -o wiki.md

# Export a cached artifact to an explicit path
cartograph export run-abc123 --to ./artifacts/wiki.md

# Run the MCP server directly
cartograph mcp
```

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

Cartograph uses an explicit hybrid install model. Installing the package does not modify Claude Code, OpenClaw, or MCP host configs automatically.

Instead, install only the integration you want:

```bash
cartograph install claude
cartograph install openclaw
cartograph install mcp
```

What each target installs:

- `claude`: user-scope skills plus the bundled documentation agents under `~/.claude`
- `openclaw`: user-scope skill pack under `~/.openclaw`
- `mcp`: a Cartograph MCP config snippet under `~/.cartograph/mcp`

Check status at any time:

```bash
cartograph doctor
cartograph doctor --json
```

## MCP Server

Cartograph's MCP server exposes static repo analysis directly to hosts that prefer MCP over shell commands.

Tools:

- `analyze_repo`: score files, map dependencies, and return top file contents for a local repo or GitHub URL
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
