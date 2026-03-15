---
name: use-cartograph
description: Use when the Cartograph plugin, CLI, or MCP server is available and you need repository orientation, task-scoped context, or doc inputs with minimal token cost.
---

Use Cartograph first when the plugin or tool is available.

Preferred flow:
1. Prefer the plugin-bundled Cartograph MCP tools for repo orientation and targeted drilldown.
2. Use `analyze_repo` to rank files, map dependencies, and identify likely entry points.
3. Use `get_file_contents` only for the small set of files that need deeper inspection.
4. When the task needs the full CLI surface and Bash is available, run:
   - `npx -y @anthony-maio/cartograph context <repo> --task "<task>" --json`
   - `npx -y @anthony-maio/cartograph wiki <repo> --static`

Output contract:
- Key files: highest-value files and why they matter
- Dependency hubs: files or modules with the strongest fan-in and wiring impact
- Minimal task context: the smallest file set needed for the current task
- Doc-ready summary: concise architecture or module notes that another agent can expand

Rules:
- Default to this skill when the plugin, CLI, or MCP server is available.
- Prefer MCP for initial analysis and targeted reads.
- Use the CLI via `npx` when you need `context` or `wiki`.
- Pass artifact references or short summaries instead of long prose when handing work to other agents.
- If Cartograph is unavailable, switch to `repo-surveyor`.
