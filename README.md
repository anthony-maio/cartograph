# Cartograph

Intelligent codebase analysis for AI agents. Instead of dumping an entire repo, Cartograph scores files by importance, maps dependencies, and gives agents only what matters.

## Two Modes

**MCP Server** — Tools that AI agents (like Claude) call directly. No external LLM needed since the agent IS the LLM.

**CLI** — Standalone tool with optional LLM-powered synthesis via Gemini, OpenAI, OpenRouter, or Ollama (local).

## Install

```bash
npm install
npm run build
```

## MCP Server

Add to your Claude config (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cartograph": {
      "command": "node",
      "args": ["/path/to/cartograph/dist/mcp.cjs"]
    }
  }
}
```

### Tools

- **`analyze_repo`** — Full static analysis: scored file list, dependency graph, top N file contents. Accepts a local path or GitHub URL.
- **`get_file_contents`** — Read specific files from a repo. Use after `analyze_repo` to drill into files of interest.

## CLI Usage

```bash
# Static mode — no LLM, no API key
cartograph ./my-project --static -o analysis.md

# Full LLM analysis
cartograph ./my-project -p gemini -k $GEMINI_KEY -o wiki.md

# Context selection — only files needed for a task
cartograph ./my-project -c "add user authentication" -p gemini -k $KEY

# Local LLM via Ollama — no API key needed
cartograph ./my-project -p ollama
cartograph ./my-project -p ollama -m llama3.1:8b

# Remote repo
cartograph https://github.com/expressjs/express --static
```

### Options

| Flag | Description |
|------|-------------|
| `-p, --provider` | LLM provider: `gemini` (default), `openai`, `openrouter`, `ollama` |
| `-k, --key` | API key (or set `CARTOGRAPH_API_KEY` env var). Not needed for Ollama. |
| `-m, --model` | Override model for both passes (e.g. `qwen3:14b`, `gpt-4.1-nano`) |
| `-o, --output` | Output file path (default: stdout) |
| `-s, --static` | Static analysis only — no LLM, no API key needed |
| `-c, --context` | Task description for context selection mode |
| `-n, --top` | Number of top files to include (default: 30) |
| `--json` | Output raw JSON instead of markdown |

## How It Works

1. **Walk** the repo, extracting imports/exports via regex across 20+ languages
2. **Score** each file by importance using heuristics:
   - Entry points (`index.ts`, `main.py`, etc.) → +30
   - README/docs → +40
   - Config files → +20
   - Fan-in (how many files import this one) → up to +50
   - Export count → up to +20
   - Root-level files → +10
   - Test files → -20
3. **Map** dependency edges between files
4. **Return** scored file list, dependency graph, and top file contents

In LLM mode (CLI only), two additional passes run:
- **Summarize** — fast model summarizes top 30 files
- **Synthesize** — strong model produces architecture overview, module docs, and context guides

## License

MIT
