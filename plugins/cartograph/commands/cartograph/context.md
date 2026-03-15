---
description: Pull the smallest useful task context for the current repo with Cartograph.
argument-hint: <task>
---

# Cartograph Context

Use Cartograph to reduce the current repository to the smallest useful file set for a concrete task.

## Arguments

The user invoked this command with: `$ARGUMENTS`

Treat the arguments as the task description. If no task is given, ask for one.

## Instructions

1. Prefer `npx -y @anthony-maio/cartograph context . --task "$ARGUMENTS" --json` when Bash is available.
2. If the CLI path is unavailable, use the bundled Cartograph MCP server plus targeted reads to reconstruct the same output contract.
3. Return:
   - key files
   - dependency hubs
   - minimal task context
   - a short rationale for why each file is included
4. Keep the file set narrow. Add extra files only when they are required for type, config, or wiring context.
