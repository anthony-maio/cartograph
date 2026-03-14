---
name: repo-surveyor
description: Use when Cartograph CLI or MCP is unavailable and you still need Cartograph-style repo orientation, task context, or documentation inputs from manual file survey.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

Use this skill only when Cartograph itself is unavailable or when you need to manually verify its outputs.

Manual workflow:
1. Discover source, config, and entry files. Skip generated, vendored, and build output.
2. Rank likely-important files using the same broad signals Cartograph uses:
   - README, AGENTS, config, entry points, routers, schemas, models
   - fan-in from imports
   - exported API surface
   - root-level wiring files
3. Trace dependency hubs around the top-ranked files instead of reading everything.
4. Build the smallest file set that satisfies the current task or documentation objective.
5. Produce a doc-ready summary from that reduced set.

Output contract:
- Key files: highest-value files and why they matter
- Dependency hubs: files or modules with the strongest fan-in and wiring impact
- Minimal task context: the smallest file set needed for the current task
- Doc-ready summary: concise architecture/module notes that another agent can expand

Rules:
- Prefer `use-cartograph` whenever the tool becomes available.
- Keep manual reads narrow. Do not read the entire repository by default.
- Match the same output shape as `use-cartograph` so downstream agents can treat both paths the same way.
