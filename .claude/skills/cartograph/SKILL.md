---
name: cartograph
description: |
  Analyze a codebase to understand its architecture without reading every file.
  Use when you need to understand a new repo, find the most important files,
  map dependencies, or get oriented before making changes. Scores files by
  importance and reads only what matters — saving tokens and context window.
allowed-tools:
  - Glob
  - Grep
  - Read
  - Bash
---

You are performing a Cartograph analysis — a structured codebase survey that identifies the most important files and maps the architecture. The goal is to understand the repo efficiently without reading everything.

## Step 1: Discover files

Use Glob to find all source files. Skip: node_modules, .git, dist, build, __pycache__, vendor, target, coverage, .next, venv, .venv.

```
Glob pattern="**/*.{ts,tsx,js,jsx,py,go,rs,java,kt,rb,php,c,cpp,cs,swift}"
```

Also find config/docs:
```
Glob pattern="**/package.json"
Glob pattern="**/README.md"
Glob pattern="**/CLAUDE.md"
Glob pattern="**/Cargo.toml"
Glob pattern="**/pyproject.toml"
Glob pattern="**/go.mod"
Glob pattern="**/Makefile"
Glob pattern="**/Dockerfile"
```

## Step 2: Score files by importance

Assign each file a score using these heuristics (apply all that match, sum them):

| Pattern | Score |
|---------|-------|
| README.md (any case) | +40 |
| CLAUDE.md | +40 |
| Entry points: index.*, main.*, app.*, server.*, mod.*, lib.* | +30 |
| Config: package.json, tsconfig.json, Cargo.toml, pyproject.toml, go.mod, Makefile, Dockerfile | +20 |
| Router/route files | +30 |
| Schema/model files | +30 |
| Root-level source files (not in subdirectory) | +10 |
| Files with many exports (check with Grep) | +3 per export, max +20 |
| Test files (.test., .spec., __test__, _test.) | -20 |
| Files under 5 lines | -10 |

Then determine **fan-in** — how many other files import each file. Use Grep to search for import/require statements referencing each candidate. Each importer adds +10, max +50.

## Step 3: Map dependencies

For the top 20 files by score, use Grep to find:
- What they import (from/require/use statements)
- What imports them (fan-in)

Build a mental dependency graph. Note which files are hubs (many connections) vs leaves.

## Step 4: Read top files

Read the top 15-20 files by importance score. For each file, note:
- **Purpose**: What does this file do? (1 sentence)
- **Public API**: What does it export?
- **Role**: entry-point, router, controller, model, service, utility, config, middleware, component, type-definitions
- **Key dependencies**: What does it rely on?

## Step 5: Synthesize

Produce a structured analysis with these sections:

### Overview
2-3 paragraphs: what the project is, what it does, who it's for.

### Architecture
How the codebase is organized. Layers, data flow, key abstractions. Reference specific files.

### File Importance Ranking
Table of the top 20 files with their scores, roles, and one-line purposes.

### Dependency Map
Key dependency relationships — which files are central hubs, what the import graph looks like.

### Module Structure
Group related files into logical modules. For each: name, purpose, key files.

### Context Guides
For 5-8 common development tasks (e.g. "add a new API endpoint", "fix a frontend bug"), list the minimal set of files someone would need to read. Explain why each file matters for that task.

## Important guidelines

- **Be efficient with tool calls.** Use Glob and Grep to survey broadly before reading. Don't read files with low importance scores.
- **Parallelize.** When you need to search for multiple patterns, do them in one message with multiple tool calls.
- **Skip generated/vendored code.** Lock files, minified bundles, generated types — don't score or read these.
- **Score before reading.** The whole point is to NOT read everything. Trust the heuristics to guide you.
- **Fan-in is the strongest signal.** A file imported by 15 others is almost certainly important regardless of other signals.
