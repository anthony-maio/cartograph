---
description: Generate a doc-ready repository summary with Cartograph.
argument-hint: [repo-or-github-url]
---

# Cartograph Wiki

Use Cartograph to produce a documentation-ready summary of a repository.

## Arguments

The user invoked this command with: `$ARGUMENTS`

If no argument is provided, use the current working directory.

## Instructions

1. Prefer `npx -y @anthony-maio/cartograph wiki <repo> --static` when Bash is available.
2. If the CLI path is unavailable, use the bundled Cartograph MCP server and targeted reads to build the summary manually.
3. Return a concise wiki-style output that covers:
   - repo purpose
   - key modules
   - dependency hubs
   - notable entry points
   - useful next-reading paths
4. Only write files if the user explicitly asks for a file path.
