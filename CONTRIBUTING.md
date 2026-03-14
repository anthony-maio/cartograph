# Contributing

Cartograph is a CLI plus MCP toolchain for codebase analysis. Keep changes small, testable, and explicit.

## Setup

```bash
npm install
```

## Development Loop

```bash
npm test
npm run check
npm run build
```

For release-surface changes, also run:

```bash
npm run pack:smoke
```

## Expectations

- Start with a failing test for behavior changes.
- Keep CLI, MCP, packaged skills, and docs aligned.
- Prefer focused commits over mixed unrelated changes.
- Do not commit secrets, API keys, or private machine-specific config.

## Pull Requests

- Explain the user-visible change and the affected surfaces.
- Note any adapter, asset, or packaging impact.
- Include the verification commands you ran.
- Update docs when command surface, install behavior, or shipped assets change.

## Reporting Issues

Use GitHub issues for bugs, docs problems, and feature requests. For security issues, follow [SECURITY.md](./SECURITY.md).
