# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

OpenCodeWiki is a smarter alternative to gitingest. Instead of dumping an entire codebase into an LLM, it scores files by importance (entry points, fan-in, exports) and runs a 3-pass analysis pipeline to produce structured architecture documentation and a "Context Builder" that selects only the files an LLM needs for a given task.

## Running Locally

```bash
npm install          # Install dependencies (first time)
npm run dev          # Start dev server (Express + Vite HMR) on http://localhost:5000
npm run check        # TypeScript type-check (no emit)
```

Requires git on PATH (the app clones repos to analyze). No test framework is configured.

## Architecture

Full-stack TypeScript app: React SPA frontend + Express API backend, served from a single process.

**Client** (`client/src/`): React 18 with wouter (hash-based routing), React Query for server state, shadcn/ui (Radix + Tailwind). Two pages: Home (input form) and Analysis (results viewer with tabs for overview, architecture, patterns, context builder, stats, modules).

**Server** (`server/`): Express 5. Stateless REST API with in-memory job storage. The analysis pipeline runs asynchronously after the POST /api/analyze response returns a jobId. Client polls GET /api/status/:jobId every 2 seconds.

**Pipeline** (the core logic):
1. **Clone** — shallow git clone to /tmp
2. **Static Analysis** (`server/analyzer.ts`) — walk files, extract imports/exports via regex, build dependency graph, compute importance scores
3. **Summarize** (`server/pipeline.ts:summarizeFiles`) — LLM summarizes top 30 files using the fast model, batched (5 for Gemini, 3 for others)
4. **Synthesize** (`server/pipeline.ts:synthesizeWiki`) — LLM produces overview/architecture/patterns/modules/contextGuide using the strong model

**Shared** (`shared/schema.ts`): Zod schemas, TypeScript types, and provider config (Gemini, OpenAI, OpenRouter with their model lists).

**Path aliases**: `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`

## API Routes

- `GET /api/providers` — list LLM providers and models
- `POST /api/analyze` — start analysis (returns jobId)
- `GET /api/status/:jobId` — poll job progress
- `GET /api/wiki/:jobId` — get completed wiki result
- `POST /api/context/:jobId` — smart context selection for a task

## Known Issues and Code Quality Notes

**Security — XSS via dangerouslySetInnerHTML**: `analysis.tsx:MarkdownContent` renders LLM-generated markdown as HTML using `dangerouslySetInnerHTML` with only `<`/`>` escaping. The hand-rolled markdown-to-HTML converter is fragile. Replace with a proper markdown renderer (react-markdown or similar) or sanitize with DOMPurify.

**API key in URL**: The analysis page passes the user's API key via URL query parameter (`?key=...`), which means it appears in browser history, server logs, and referrer headers. Should use sessionStorage or a POST-based flow instead.

**Memory leak — no job cleanup**: `jobFileContents` and `jobLLMConfigs` Maps in `routes.ts` grow unbounded. Jobs and their file contents are never evicted. Add TTL-based cleanup.

**Unused dependencies**: package.json includes many deps from the Replit template that aren't used: `pg`, `connect-pg-simple`, `passport`, `passport-local`, `express-session`, `memorystore`, `drizzle-orm`, `drizzle-zod`, `drizzle-kit`, `ws`, `recharts`, `framer-motion`, `react-hook-form`, `react-day-picker`, `embla-carousel-react`, `cmdk`, `input-otp`, `next-themes`, `react-icons`, `react-resizable-panels`, `vaul`, and most Radix primitives. The drizzle config (`drizzle.config.ts`) points to PostgreSQL but no DB is used.

**Build script allowlist drift**: `script/build.ts` allowlist includes packages not in dependencies (axios, cors, express-rate-limit, jsonwebtoken, multer, nanoid, nodemailer, stripe, uuid, xlsx). Harmless but misleading.

**`queryClient.ts` placeholder**: The `API_BASE` logic (`"__PORT_5000__".startsWith("__")`) is a Replit convention that does nothing outside that environment. Can be simplified to `""`.

**Temp directory on Windows**: `analyzer.ts` hardcodes `/tmp` which doesn't exist on Windows. Use `os.tmpdir()` instead.

**No rate limiting**: The LLM-calling endpoints have no rate limiting. Anyone with the URL can trigger expensive LLM API calls using someone else's key (keys are passed per-request, not stored server-side, which is good — but there's no abuse prevention).

**49 shadcn/ui components**: Only ~10 are actually used (Button, Input, Card, Select, Tabs, Textarea, Progress, ScrollArea, Separator, Badge, Toast, Tooltip). The rest are dead code from the template.
