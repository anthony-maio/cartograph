# Cartograph Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first production-ready foundation for Cartograph's single-package distribution model: command expansion, adapter registry, artifact cache, and Slipstream-backed internal coordination.

**Architecture:** Keep the existing analyzer and pipeline logic, but move new behavior into small host-agnostic modules. CLI remains the universal entrypoint, adapters stay thin, artifacts live in user cache, and a minimal native TypeScript Slipstream layer handles internal coordination and A2A metadata.

**Tech Stack:** TypeScript, Node.js, Commander, esbuild, Zod, node:test, tsx

---

### Task 1: Add the test harness and CLI foundation checks

**Files:**
- Create: `tests/helpers/run-cli.ts`
- Create: `tests/cli/command-surface.test.ts`
- Modify: `package.json`

**Step 1: Write the failing tests**

Create `tests/cli/command-surface.test.ts` to assert:
- `cartograph --help` shows the existing analyze surface
- the new top-level command surface includes `install`, `uninstall`, `doctor`, `export`, and `mcp`
- help text references `CARTOGRAPH_API_KEY`, not `OPENCODEWIKI_API_KEY`

Create `tests/helpers/run-cli.ts` with a small helper that spawns the source CLI through `tsx`.

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/cli/command-surface.test.ts`
Expected: FAIL because the project has no `test` script and the new commands do not exist yet.

**Step 3: Write the minimal implementation**

- Add `test` and `test:watch` scripts in `package.json` using `node --import tsx --test`.
- Refactor CLI setup enough to expose the future command names in help output.
- Fix the help text to use `CARTOGRAPH_API_KEY`.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/cli/command-surface.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json tests/helpers/run-cli.ts tests/cli/command-surface.test.ts src/cli.ts
git commit -m "test(cli): add command surface coverage"
```

### Task 2: Add the Slipstream TypeScript wire layer

**Files:**
- Create: `src/slipstream/constants.ts`
- Create: `src/slipstream/wire.ts`
- Create: `src/slipstream/a2a.ts`
- Create: `tests/slipstream/wire.test.ts`
- Create: `tests/slipstream/a2a.test.ts`

**Step 1: Write the failing tests**

Add tests for:
- `formatSlip()` producing `SLIP v3 src dst Force Object [payload...]`
- `formatFallback()` producing `Fallback Generic <ref>`
- `parseSlip()` returning a structured message with `fallbackRef`
- `validateSlip()` returning issue arrays instead of throwing
- `buildSlipA2AMessage()` emitting the Slipstream A2A extension URI and metadata

Use only the v3 core rules agreed in the design:
- closed 12-force vocabulary
- alphanumeric tokens only
- payload max 20
- fallback ref required and 1-16 chars

**Step 2: Run tests to verify they fail**

Run:
- `npm test -- tests/slipstream/wire.test.ts`
- `npm test -- tests/slipstream/a2a.test.ts`

Expected: FAIL because the modules do not exist yet.

**Step 3: Write the minimal implementation**

Implement:
- force constants and token validators
- a `SlipMessage` TypeScript interface
- `formatSlip()`
- `formatFallback()`
- `parseSlip()`
- `validateSlip()`
- A2A helpers for message and metadata construction

Do not implement quantization, UCR mutation, or non-core extension logic in v1.

**Step 4: Run tests to verify they pass**

Run:
- `npm test -- tests/slipstream/wire.test.ts`
- `npm test -- tests/slipstream/a2a.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/slipstream tests/slipstream
git commit -m "feat(slipstream): add typescript wire helpers"
```

### Task 3: Add artifact cache and export primitives

**Files:**
- Create: `src/app/cache.ts`
- Create: `src/app/artifacts.ts`
- Create: `tests/app/cache.test.ts`
- Create: `tests/app/artifacts.test.ts`

**Step 1: Write the failing tests**

Add tests for:
- resolving the default user cache root
- deriving a stable repo fingerprint
- creating a run directory and manifest
- exporting a named artifact to an explicit destination
- rejecting export when `--to` is missing

**Step 2: Run tests to verify they fail**

Run:
- `npm test -- tests/app/cache.test.ts`
- `npm test -- tests/app/artifacts.test.ts`

Expected: FAIL because the cache modules do not exist.

**Step 3: Write the minimal implementation**

Implement:
- `getCacheRoot()`
- `getRepoFingerprint()`
- `createRunWorkspace()`
- manifest persistence helpers
- `exportRunArtifact(runId, destination)`

Keep the storage model file-based and user-cache-first.

**Step 4: Run tests to verify they pass**

Run:
- `npm test -- tests/app/cache.test.ts`
- `npm test -- tests/app/artifacts.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/cache.ts src/app/artifacts.ts tests/app/cache.test.ts tests/app/artifacts.test.ts
git commit -m "feat(cache): add artifact workspace primitives"
```

### Task 4: Refactor the CLI into subcommands and shared execution paths

**Files:**
- Create: `src/app/program.ts`
- Create: `src/app/commands/analyze.ts`
- Create: `src/app/commands/context.ts`
- Create: `src/app/commands/wiki.ts`
- Create: `src/app/commands/export.ts`
- Modify: `src/cli.ts`
- Modify: `src/analyzer.ts`
- Modify: `src/pipeline.ts`
- Modify: `src/markdown.ts`
- Create: `tests/cli/analyze-command.test.ts`
- Create: `tests/cli/context-command.test.ts`
- Create: `tests/cli/export-command.test.ts`

**Step 1: Write the failing tests**

Add tests for:
- `cartograph analyze <repo> --static`
- `cartograph context <repo> --task "..."`
- `cartograph wiki <repo>`
- `cartograph export <run-id> --to <path>`
- context selection being able to load files outside the initial top-N contents set

**Step 2: Run tests to verify they fail**

Run:
- `npm test -- tests/cli/analyze-command.test.ts`
- `npm test -- tests/cli/context-command.test.ts`
- `npm test -- tests/cli/export-command.test.ts`

Expected: FAIL because the subcommands and full file-loading behavior do not exist yet.

**Step 3: Write the minimal implementation**

- Split CLI logic into shared command handlers
- Keep `cartograph <repo>` working as the default analyze path for compatibility
- Add explicit `analyze`, `context`, `wiki`, and `export` commands
- Fix context selection so selected file contents are loaded on demand instead of being limited to the initial top-N scan

**Step 4: Run tests to verify they pass**

Run the three targeted test files above.
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli.ts src/app/program.ts src/app/commands src/analyzer.ts src/pipeline.ts src/markdown.ts tests/cli
git commit -m "feat(cli): add subcommands and export flow"
```

### Task 5: Add the adapter registry and host install commands

**Files:**
- Create: `src/app/adapters/types.ts`
- Create: `src/app/adapters/index.ts`
- Create: `src/app/adapters/claude.ts`
- Create: `src/app/adapters/openclaw.ts`
- Create: `src/app/adapters/mcp.ts`
- Create: `src/app/commands/install.ts`
- Create: `src/app/commands/uninstall.ts`
- Create: `src/app/commands/doctor.ts`
- Create: `assets/claude/skills/.gitkeep`
- Create: `assets/claude/agents/.gitkeep`
- Create: `assets/openclaw/skills/.gitkeep`
- Create: `assets/openclaw/agents/.gitkeep`
- Create: `tests/app/adapters.test.ts`
- Create: `tests/cli/install-command.test.ts`
- Create: `tests/cli/doctor-command.test.ts`

**Step 1: Write the failing tests**

Add tests for:
- registry lookup by adapter id
- install command requiring an explicit target
- user-scope install paths for `claude`, `openclaw`, and `mcp`
- `doctor` reporting installed and missing assets

**Step 2: Run tests to verify they fail**

Run:
- `npm test -- tests/app/adapters.test.ts`
- `npm test -- tests/cli/install-command.test.ts`
- `npm test -- tests/cli/doctor-command.test.ts`

Expected: FAIL because the registry and commands do not exist yet.

**Step 3: Write the minimal implementation**

- Add adapter manifests and handlers
- Implement explicit install and uninstall paths
- Implement a `doctor` summary with adapter status
- Keep install behavior user-scope and opt-in only

**Step 4: Run tests to verify they pass**

Run the targeted test files above.
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/adapters src/app/commands/install.ts src/app/commands/uninstall.ts src/app/commands/doctor.ts assets tests/app/adapters.test.ts tests/cli/install-command.test.ts tests/cli/doctor-command.test.ts
git commit -m "feat(adapters): add install and doctor commands"
```

### Task 6: Update docs, skills, and packaged behavior

**Files:**
- Modify: `README.md`
- Modify: `.claude/skills/cartograph/SKILL.md`
- Modify: `.agents/skills/cartograph/SKILL.md`
- Modify: `package.json`
- Create: `tests/cli/readme-surface.test.ts`

**Step 1: Write the failing test**

Add a small test that checks the README and CLI help both describe the new command surface and the correct environment variable naming.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/readme-surface.test.ts`
Expected: FAIL until docs and packaging metadata are updated.

**Step 3: Write the minimal implementation**

- Update README command examples
- Convert the bundled skills from manual-analysis instructions into install-and-use guidance
- Ensure package metadata and scripts reflect the expanded CLI

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/readme-surface.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md .claude/skills/cartograph/SKILL.md .agents/skills/cartograph/SKILL.md package.json tests/cli/readme-surface.test.ts
git commit -m "docs(package): align skills and cli guidance"
```

## Verification Sequence

After every task:

- run the targeted tests first
- run `npm run check`

After Tasks 2, 4, and 5:

- run `npm run build`

At the end:

- run `npm test`
- run `npm run check`
- run `npm run build`

## Execution Mode

The validated design is already approved, and the user asked to plan and build in the same session. Proceed with the in-session execution path after saving this plan.
