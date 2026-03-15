---
description: Analyze a local repo or GitHub repo with Cartograph and return the highest-signal architecture map.
argument-hint: [repo-or-github-url]
---

# Cartograph Analyze

Use Cartograph to build the first high-signal repo map.

## Arguments

The user invoked this command with: `$ARGUMENTS`

If no argument is provided, analyze the current working directory.

## Instructions

1. Prefer the Cartograph MCP server bundled by this plugin.
2. Run `analyze_repo` against the provided repo path or GitHub URL.
3. Use `get_file_contents` only for the small number of files needed to clarify major wiring or entry points.
4. Return:
   - key files
   - dependency hubs
   - a concise architecture summary
5. Keep the answer tight. Do not expand into a full wiki unless the user asks.
