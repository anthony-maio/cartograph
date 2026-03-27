# Task Packet Benchmark

This benchmark gives Cartograph a stable public suite for evaluating task packets against large visible repositories.

## Goals

- stress different repo shapes instead of tuning only on one project
- compare packet quality across `bug-fix`, `pr-review`, `trace-flow`, `change-request`, and `task`
- catch false positives such as docs, utility scripts, or unrelated subsystems leaking into focused packets

## Cases

The benchmark manifest lives in [`manifest.json`](./manifest.json).

Current coverage includes:

- `ggml-org/llama.cpp`
- `microsoft/vscode`
- `vercel/next.js`
- `fastapi/fastapi`
- `open-webui/open-webui`
- `kubernetes/kubernetes`
- `home-assistant/core`
- `pytorch/pytorch`

## Runner

List all cases:

```bash
npm run benchmark:task-packets -- --list
```

Dry-run a single case:

```bash
npm run benchmark:task-packets -- --case llama-cpp-bug-fix --dry-run
```

Generate packet artifacts:

```bash
npm run build
npm run benchmark:task-packets -- --output benchmarks/task-packets/output
```

The runner writes one packet per case plus an `index.json` summary. Output is gitignored.

## Manual Scoring Rubric

Score each packet on:

- changed files appear first when they are known
- `minimalContext` stays tight and plausible
- `validationTargets` surface the exact or nearest useful tests
- `dependencyHubs` are real shared dependencies, not peripheral utilities
- no docs, generated artifacts, or unrelated subsystems leak into `keyFiles`
- `recommendedNextSteps` are actionable for the packet type

## Release Use

Run this suite when:

- task-packet heuristics change
- a new false positive appears in a real repo
- a release claims better packet focus or hub selection
