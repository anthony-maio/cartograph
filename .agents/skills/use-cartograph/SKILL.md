---
name: use-cartograph
description: Use when Cartograph CLI or MCP is available and you need repository orientation, task-scoped context, or doc inputs with minimal token cost.
---

Use Cartograph first when the tool is available.

Preferred flow:
1. Check whether `cartograph` or the Cartograph MCP server is available.
2. For repo orientation, run `cartograph analyze <repo> --static --json`.
3. For task work, run `cartograph context <repo> --task "<task>" --json`.
4. For documentation output, run `cartograph wiki <repo> --static` or `cartograph wiki <repo> -p <provider>`.
5. Export only when a human needs a concrete file path: `cartograph export <run-id> --to <path>`.

Output contract:
- Key files
- Dependency hubs
- Minimal task context
- Doc-ready summary

Rules:
- Default to this skill when Cartograph is available.
- Pass run IDs and artifact references instead of copying long prose.
- If Cartograph is unavailable, switch to `repo-surveyor`.
