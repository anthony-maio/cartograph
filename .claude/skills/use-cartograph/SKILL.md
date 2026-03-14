---
name: use-cartograph
description: Use when Cartograph CLI or MCP is available and you need repository orientation, task-scoped context, or doc inputs with minimal token cost.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

Use Cartograph first when the tool is available.

Preferred flow:
1. Check whether `cartograph` or the Cartograph MCP server is available.
2. For repo orientation, run `cartograph analyze <repo> --static --json`.
3. For task work, run `cartograph context <repo> --task "<task>" --json`.
4. For documentation output, run `cartograph wiki <repo> --static` or `cartograph wiki <repo> -p <provider>`.
5. Export only when a human needs a concrete file path: `cartograph export <run-id> --to <path>`.

Output contract:
- Key files: highest-value files and why they matter
- Dependency hubs: files or modules with the strongest fan-in and wiring impact
- Minimal task context: the smallest file set needed for the current task
- Doc-ready summary: concise architecture/module notes that another agent can expand

Rules:
- Default to this skill when Cartograph is available.
- Pass run IDs and artifact references instead of copying long prose between agents.
- If Cartograph is unavailable, switch to `repo-surveyor`.
- If you need to verify an edge case manually, keep the same output contract.
