# Open Source Release Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the missing repository, packaging, CI, and documentation surface required for an open source release.

**Architecture:** Keep the implementation small and mechanical. Use a failing release-readiness test to pin required files and scripts, then add the legal docs, package metadata, CI workflow, tarball smoke test, and release checklist needed to verify what actually ships.

**Tech Stack:** Node.js, npm, GitHub Actions, Node test runner

---

### Task 1: Pin the release surface with a failing test

**Files:**
- Create: `tests/release/release-readiness.test.ts`
- Test: `tests/release/release-readiness.test.ts`

**Step 1: Write the failing test**

Add assertions for:

- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/workflows/ci.yml`
- `scripts/pack-smoke.mjs`
- package metadata and release scripts
- CI commands for test, typecheck, build, and tarball smoke

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/release/release-readiness.test.ts`
Expected: FAIL because the legal files and CI workflow do not exist yet.

### Task 2: Add legal and community docs

**Files:**
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `CODE_OF_CONDUCT.md`

**Step 1: Write the minimal docs**

Add:

- MIT license text
- contribution workflow and verification commands
- private security reporting instructions
- contributor covenant code of conduct

**Step 2: Verify the test still fails on the remaining missing files**

Run: `npm test -- tests/release/release-readiness.test.ts`
Expected: FAIL because package metadata, CI, and smoke test script are still missing.

### Task 3: Add packaging metadata and tarball smoke coverage

**Files:**
- Modify: `package.json`
- Create: `scripts/pack-smoke.mjs`

**Step 1: Add package metadata**

Add:

- `repository`
- `homepage`
- `bugs`
- `keywords`
- `engines`
- `pack:smoke`
- `release:check`

**Step 2: Add the smoke script**

Implement a Node script that:

- runs `npm pack --json`
- installs the tarball into a temp directory
- invokes the packaged CLI against the repo with static analysis
- validates basic JSON output
- removes temp files and the tarball

**Step 3: Run test to verify it still fails only on CI**

Run: `npm test -- tests/release/release-readiness.test.ts`
Expected: FAIL until the workflow file exists.

### Task 4: Add CI and release docs

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/release-checklist.md`
- Modify: `README.md`

**Step 1: Add CI workflow**

Run `npm ci`, `npm test`, `npm run check`, `npm run build`, and `npm run pack:smoke` on push and pull request.

**Step 2: Add release checklist**

Document the verification commands plus the npm package-name blocker.

**Step 3: Update README**

Link to contribution and security docs and keep install guidance honest for source users.

### Task 5: Verify and commit

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Test: `tests/release/release-readiness.test.ts`

**Step 1: Run targeted verification**

Run:

- `npm test -- tests/release/release-readiness.test.ts`
- `npm run pack:smoke`

Expected: PASS

**Step 2: Run the full verification suite**

Run:

- `npm test`
- `npm run check`
- `npm run build`
- `npm pack --dry-run`

Expected: PASS

**Step 3: Commit**

```bash
git add LICENSE CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md .github/workflows/ci.yml scripts/pack-smoke.mjs docs/release-checklist.md docs/plans/2026-03-14-open-source-release-readiness.md package.json README.md tests/release/release-readiness.test.ts
git commit -m "chore(release): add open source release scaffolding"
```
