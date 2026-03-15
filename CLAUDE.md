# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Cartograph is an MCP server + CLI tool for intelligent codebase analysis. It scores files by importance (entry points, fan-in, exports), maps dependencies, and provides targeted context for AI agents. Instead of dumping an entire repo, it gives agents only what matters.

Two modes:
- **MCP server** (`src/mcp.ts`) — Tools that AI agents call directly. No external LLM needed since the agent IS the LLM.
- **CLI** (`src/cli.ts`) — Standalone tool with optional LLM-powered synthesis via Gemini/OpenAI/OpenRouter.

## Commands

```bash
npm install          # Install dependencies
npm run dev -- <args>  # Run CLI in dev mode (e.g. npm run dev -- . --static)
npm run dev:mcp      # Run MCP server in dev mode
npm run build        # Bundle both CLI and MCP server to dist/
npm run start -- <args>  # Run built CLI
npm run start:mcp    # Run built MCP server
npm run check        # TypeScript type-check (no emit)
```

## MCP Server

The MCP server can be registered in a Claude Code or Claude Desktop config. It exposes two tools:

- **`analyze_repo`** — Full static analysis: scored file list, dependency graph, top N file contents. Accepts local path or GitHub URL.
- **`get_file_contents`** — Read specific files from a repo. Use after `analyze_repo` to drill into files of interest.

## CLI Usage

```bash
cartograph <repo> [options]

# Static mode (no LLM, no API key)
cartograph ./my-project --static -o analysis.md

# Full LLM analysis
cartograph ./my-project -p gemini -k $CARTOGRAPH_API_KEY -o wiki.md

# Context selection — only files needed for a task
cartograph ./my-project -c "add user authentication" -p gemini -k $CARTOGRAPH_API_KEY
```

Providers: `gemini` (default), `openai`, `openrouter`. Key via `--key` or `CARTOGRAPH_API_KEY` env var.

## Architecture

All source in `src/`. Two entry points, shared core.

**Core** (pure logic, no web deps):
- `src/analyzer.ts` — Git clone, file walking, import/export extraction, importance scoring heuristics
- `src/schema.ts` — All TypeScript types, Zod schemas, provider/model config
- `src/pipeline.ts` — LLM-powered 3-pass pipeline (summarize → synthesize → context select)
- `src/llm.ts` — Unified LLM client (Gemini native SDK, OpenAI/OpenRouter via OpenAI SDK)
- `src/markdown.ts` — Serializers for wiki/static/context output formats

**Entry points:**
- `src/mcp.ts` — MCP server via `@modelcontextprotocol/sdk`, stdio transport
- `src/cli.ts` — CLI via commander, with ora spinners and chalk output

## Build

esbuild bundles to `dist/cli.cjs` and `dist/mcp.cjs`. External: `simple-git`, `@google/genai`, `openai`, `@modelcontextprotocol/sdk`. The `.cjs` extension is required because `package.json` has `"type": "module"` but esbuild outputs CommonJS.
