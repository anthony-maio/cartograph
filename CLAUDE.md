# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

OpenCodeWiki is a CLI tool — a smarter alternative to gitingest. Instead of dumping an entire codebase into an LLM, it scores files by importance (entry points, fan-in, exports) and runs a 3-pass LLM pipeline to produce structured architecture documentation. It also has a context selection mode that picks only the files an LLM needs for a specific task.

## Commands

```bash
npm install          # Install dependencies
npm run dev -- <args>  # Run CLI in dev mode via tsx (e.g. npm run dev -- . -p gemini -k $KEY)
npm run build        # Bundle to dist/cli.cjs via esbuild
npm run start -- <args>  # Run built CLI
npm run check        # TypeScript type-check (no emit)
```

## CLI Usage

```bash
opencodewiki <repo> [options]

# Full analysis of a local repo
opencodewiki ./my-project -p gemini -k $GEMINI_KEY -o wiki.md

# Full analysis of a remote repo
opencodewiki https://github.com/owner/repo -p openai -k $OPENAI_KEY

# Context selection — get only the files needed for a task
opencodewiki ./my-project -c "add user authentication" -p gemini -k $KEY

# JSON output
opencodewiki ./my-project -p gemini -k $KEY --json -o data.json
```

Providers: `gemini` (default), `openai`, `openrouter`. Key can also be set via `OPENCODEWIKI_API_KEY` env var.

## Architecture

Single-process CLI tool. All source in `src/`.

**Pipeline** (the core — runs sequentially):
1. **Clone or use local** — shallow git clone for URLs, direct path for local repos
2. **Static Analysis** (`src/analyzer.ts`) — walk files, extract imports/exports via regex, build dependency graph, compute importance scores
3. **Summarize** (`src/pipeline.ts:summarizeFiles`) — fast LLM model summarizes top 30 files, batched (5 for Gemini, 3 for others)
4. **Synthesize** (`src/pipeline.ts:synthesizeWiki`) — strong LLM model produces overview/architecture/patterns/modules/contextGuide
5. **Output** (`src/markdown.ts`) — serialize WikiResult to markdown or JSON

**Key files:**
- `src/cli.ts` — Entry point, argument parsing (commander), orchestration
- `src/analyzer.ts` — Git clone, file walking, import/export extraction, importance scoring
- `src/pipeline.ts` — LLM-powered summarization and synthesis (provider-agnostic)
- `src/llm.ts` — Unified LLM client abstraction (Gemini native SDK, OpenAI/OpenRouter via OpenAI SDK)
- `src/schema.ts` — All TypeScript types, Zod schemas, provider/model config
- `src/markdown.ts` — WikiResult and context results to markdown serialization

## Build

esbuild bundles everything to a single `dist/cli.cjs` file. `simple-git`, `@google/genai`, and `openai` are externalized (kept as runtime dependencies). The `.cjs` extension is required because `package.json` has `"type": "module"` but esbuild outputs CommonJS.
