---
name: cartograph
description: Use Cartograph to analyze a repository, select minimal task context, and generate repo documentation without reading the entire tree.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

Use Cartograph before doing broad manual repo survey work.

Preferred flow:
1. Check whether `cartograph` is available.
2. For architecture mapping, run `cartograph analyze <repo> --static --json`.
3. For task-scoped work, run `cartograph context <repo> --task "<task>" --json`.
4. For documentation output, run `cartograph wiki <repo> --static` or `cartograph wiki <repo> -p <provider>`.
5. Export a cached artifact only when a human asks for a file path: `cartograph export <run-id> --to <path>`.

Guidelines:
- Prefer the CLI first. Use MCP only when the host already has Cartograph configured as an MCP server.
- Keep the main context small. Read Cartograph output before opening source files.
- If Cartograph is unavailable, fall back to manual repo survey.
- When using the bundled Cartograph agents, pass run IDs or artifact paths instead of copying long prose between agents.
