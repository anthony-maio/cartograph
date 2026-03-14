# Cartograph Distribution Design

Date: 2026-03-13
Status: Validated

## Summary

Cartograph will ship as one package with one executable, `cartograph`. The package will support three usage surfaces: direct CLI, optional MCP, and host-specific agent adapters for Claude Code and OpenClaw. The package will not auto-install itself into every supported host. Instead, it will use an explicit hybrid install model with user-scope defaults.

The core product goal is simple: give coding agents the smallest useful slice of repository context without forcing them to read the whole repo. Cartograph will analyze local or remote repositories, rank files, map dependencies, generate task-focused context sets, and produce docs. The same core engine will power every host integration.

Cartograph will also adopt Slipstream as its canonical internal agent-to-agent coordination protocol. The internal TypeScript implementation will target the `SLIP v3` wire format and enforce v3.1 invariants. Slipstream messages will carry compact coordination intent. Heavy payloads will live in artifacts, not on the wire.

## Goals

- Ship one package for all supported environments.
- Make CLI the universal fallback surface.
- Keep MCP optional.
- Support Claude Code and OpenClaw with bundled skills and agent assets.
- Minimize main-context usage by passing artifact references between agents.
- Avoid dirtying the user’s repo unless they explicitly export output.

## Non-Goals

- No mandatory background MCP setup.
- No automatic writes into supported host config locations on install.
- No default writes into the current repo.
- No Cartograph-specific Slipstream object extensions in v1.

## Product Shape

Cartograph will expose one executable with a stable command set:

- `cartograph analyze <repo>`
- `cartograph context <repo> --task "..."`
- `cartograph wiki <repo>`
- `cartograph mcp`
- `cartograph install <target>`
- `cartograph uninstall <target>`
- `cartograph doctor`
- `cartograph export <run-id> --to <path>`
- `cartograph gc`

The CLI is the primary transport-neutral interface. Every bundled skill or agent should prefer calling the CLI first. MCP remains available for users who want a tool-server integration path.

## Internal Architecture

The package will use one shared core plus an internal adapter registry.

### Core

The core owns host-agnostic behavior:

- repository resolution for local paths and GitHub URLs
- static analysis and file ranking
- dependency extraction
- content selection and truncation
- task context selection
- API surface extraction
- wiki generation
- cache and artifact management
- Slipstream wire helpers for internal coordination

### Adapter registry

Each adapter will define:

- `id`
- `detect()`
- `install()`
- `uninstall()`
- `doctor()`
- asset locations
- default install target

Initial adapters:

- `claude`
- `openclaw`
- `mcp`

This keeps one package for users and clean internal boundaries for implementation.

## Install Model

Cartograph will use a hybrid install model.

- `npm install -g @anthony-maio/cartograph` or equivalent installs the package only.
- Host integration is explicit.
- The default install scope is user-level, not project-level.

Install commands:

- `cartograph install claude`
- `cartograph install openclaw`
- `cartograph install mcp`

Uninstall commands:

- `cartograph uninstall claude`
- `cartograph uninstall openclaw`
- `cartograph uninstall mcp`

The package must never silently install itself into all supported hosts.

## Bundled Assets

The package will bundle adapter assets inside the published package.

Planned layout:

- `assets/claude/skills/`
- `assets/claude/agents/`
- `assets/openclaw/skills/`
- `assets/openclaw/agents/`

These assets are thin wrappers around the core CLI and optional MCP server. They should teach the host agent how to call Cartograph, interpret artifacts, and hand work between agents with minimal prompt overhead.

## V1 Agent Bundle

Cartograph v1 will ship a balanced agent bundle:

- `repo-scout`
- `dependency-tracer`
- `context-picker`
- `api-surface-writer`
- `wiki-writer`

Responsibilities:

- `repo-scout` runs analysis and writes the initial artifact set.
- `dependency-tracer` expands hubs, inbound edges, and module relationships.
- `context-picker` turns a development task into a minimal file set.
- `api-surface-writer` extracts exported APIs and boundaries.
- `wiki-writer` assembles architecture and onboarding docs from prior artifacts.

These agents should communicate primarily by artifact references, not long natural-language summaries.

## Slipstream Integration

Cartograph will use Slipstream as its canonical internal coordination layer.

### Protocol target

- Wire version: `SLIP v3`
- Semantic and validation target: v3.1 invariants
- Intent model: factorized `Force x Object`
- Force vocabulary: closed set only
- Fallback: strict ref-only behavior

Cartograph will include a small native TypeScript implementation of the interoperable subset needed for:

- formatting wires
- parsing wires
- validation
- fallback formatting
- A2A metadata helpers

Cartograph will not port the full Python SDK in v1. The TypeScript layer only needs the wire and metadata subset required for host adapters and internal routing.

### V1 Slipstream profile

Cartograph v1 will stay inside the core Slipstream object vocabulary. It will not define Cartograph-specific extension objects in v1.

Typical wires:

- `SLIP v3 scout picker Inform Result analysis123`
- `SLIP v3 picker writer Meta Handoff ctx42`
- `SLIP v3 writer reviewer Request Review wiki7`
- `SLIP v3 reviewer writer Eval NeedsWork wiki7`
- `SLIP v3 writer scout Ask Clarify scope1`
- `SLIP v3 any any Fallback Generic ref7f3a`

Repo-specific meaning belongs in artifacts and manifests, not in custom wire objects.

## Artifact Model

Cartograph will store working artifacts in user cache by default.

Default cache layout:

- `~/.cartograph/cache/<repo-fingerprint>/<run-id>/`

Example artifacts:

- `analysis.json`
- `dependencies.json`
- `task-context.json`
- `api-surface.json`
- `wiki.md`
- `manifest.json`

Reasons for user-cache default:

- avoids dirtying the working tree
- works for local and remote repos
- supports read-only repos
- keeps intermediate artifacts out of commits
- matches Slipstream’s artifact-reference handoff model

## Export Model

Cartograph will never write into the repo by default.

If a user wants repo-visible output, they must provide an explicit export path:

- `cartograph export <run-id> --to <path>`

There is no default export target such as `docs/cartograph/`. Export is always deliberate.

## MCP Positioning

MCP remains part of the product, but it is optional.

- CLI is the lowest-friction surface.
- MCP is the richer tool-server integration path.
- Skills and agents should work without MCP.
- Users who do not want MCP should still get a complete product.

This keeps Cartograph useful in shells, agent runtimes, and lightweight local workflows.

## Differentiation

Cartograph should differentiate on useful context reduction, not generic doc generation.

Core differentiators:

- explainable file ranking
- task-focused context packets
- cross-host packaging in one package
- local-first and no-LLM usage paths
- artifact-first coordination for low-context agent workflows
- Slipstream-backed compact internal handoffs

## Implementation Notes

Early implementation should fix current product inconsistencies before expanding the surface area:

- unify API key naming across help text, docs, and runtime behavior
- ensure task-context mode can load files outside the initial top-N set
- replace manual-analysis skill content with install-and-use guidance for the packaged product
- add real bundled agent assets for Claude and OpenClaw

## Ready State

This design is ready for implementation planning. The next step is to convert it into a concrete implementation plan and start building the package structure, adapter registry, artifact cache, and Slipstream TypeScript layer.
