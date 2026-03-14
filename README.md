# Cartograph

Cartograph is a single-package repo analysis tool for coding agents. It ships a CLI, an MCP server, user-scope install adapters for Claude Code and OpenClaw, and packaged agent assets for documentation-heavy workflows.

Instead of dumping an entire repository into context, Cartograph ranks the files that matter, maps dependencies, caches structured artifacts, and lets the next tool or agent pick up from those artifacts.

## Install

```bash
npm install
npm run build
```

For global use from a local checkout:

```bash
npm install -g .
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow and [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## Command Surface

```bash
cartograph analyze <repo> [options]
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
