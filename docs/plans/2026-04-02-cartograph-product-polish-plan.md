# Cartograph Product Polish Plan

**Goal:** Move Cartograph from “impressive agent infrastructure” to a product that feels opinionated, fast, and easy to adopt.

**Core position:** Cartograph should be known as the fastest way to generate task-shaped repo context for coding agents. The product center is not “wiki generation” and not “repo analysis” in the abstract. It is: *given a repo and a task, produce the smallest useful artifact for the next agent or human*.

**Why this plan exists:** The current release has strong technical depth: CLI, MCP, Claude plugin distribution, OpenClaw skills, task packets, benchmarks, example artifacts, and deterministic code. That is enough to prove capability, but it still risks reading like a research artifact because the product story is spread across too many surfaces and the defaults still expose internal power instead of a guided workflow.

---

## Product Truth

Cartograph already wins on:

- deterministic implementation instead of prompt-only behavior
- host-agnostic core with CLI, MCP, Claude, and OpenClaw surfaces
- strong task-packet architecture
- explicit benchmarks and tracked example artifacts
- user-cache-first artifact model that keeps repos clean

Cartograph is still weak on:

- a single obvious “start here” workflow
- output ergonomics for small repos and first-time users
- strong explanation of when to use `analyze`, `context`, `packet`, or `wiki`
- product framing on the site and README
- proof that the tool is better than direct reads for medium and large repos
- visible UX affordances around speed, defaults, and trust

The product risk is not lack of capability. The product risk is **surface sprawl**.

---

## Product Surface

Cartograph should present one primary workflow and three secondary workflows.

### Primary workflow

`analyze -> packet -> context`

That is the product.

- `analyze` gives the repo map
- `packet` gives the typed working artifact for a concrete job
- `context` gives the smallest file bundle needed to execute

### Secondary workflows

- `wiki`: documentation/export flow for onboarding or architecture references
- `install`: host integration flow for Claude, OpenClaw, and MCP
- `benchmark/examples`: proof surface for users evaluating quality before adoption

### Explicit positioning rule

The homepage, README, and release notes should all describe Cartograph as:

> Task-shaped repo context for coding agents.

That phrasing is tighter than “intelligent wiki generation” and more product-like than “repo analysis.”

---

## Product Gaps To Close

### 1. First-run ergonomics

Current problem:

- users see many commands and surfaces before they see one obvious outcome
- `analyze --static --json` can feel too raw if it dumps implementation-oriented output

Near-term fix:

- keep the compact small-repo default
- document `--include-contents` as an explicit opt-in
- add a human-first summary mode for `analyze`
- make `packet` the recommended second command everywhere

Definition of done:

- a new user can install the package and understand the correct next command in under 30 seconds

### 2. Output hierarchy

Current problem:

- `analyze`, `context`, `packet`, and `wiki` are all powerful, but the relationship between them is not obvious

Near-term fix:

- define each command by job-to-be-done:
  - `analyze`: “map the repo”
  - `packet`: “prepare the work”
  - `context`: “load the minimum files”
  - `wiki`: “brief a human”
- add this hierarchy to README, quickstart, and plugin docs

Definition of done:

- the command surface reads like a workflow, not a toolbox dump

### 3. Product proof

Current problem:

- the benchmark suite exists, but it is still developer-facing
- example artifacts exist, but they are not yet framed as evidence

Near-term fix:

- publish benchmark scorecards for a few canonical repos
- show “good packet” examples directly on the site
- add one short case-study section:
  - small repo: direct reads are fine, Cartograph stays compact
  - medium repo: `packet` and `context` save time
  - large repo: `analyze` and task packets become the triage layer

Definition of done:

- users can answer “why use this?” without reading the source

### 4. Workflow-specific polish

Current problem:

- task packets are the strongest feature, but they still read as a power-user feature

Near-term fix:

- ship packet presets more visibly:
  - `bug-fix`
  - `pr-review`
  - `trace-flow`
  - `change-request`
- add short examples for each packet type
- add recommended follow-on commands or agent prompts after packet generation

Definition of done:

- the user understands not just what the packet is, but what to do next

### 5. Distribution clarity

Current problem:

- Cartograph is available from npm, GitHub, Claude plugin flow, ClawHub/OpenClaw, GitHub Pages, and the MCP Registry
- discoverability is good, but the install story is still fragmented

Near-term fix:

- create one comparison table:
  - CLI
  - Claude plugin
  - OpenClaw skills
  - MCP Registry
- state clearly when each path should be used
- keep the CLI as the universal fallback and product center

Definition of done:

- users stop asking “which install path should I use?”

### 6. Trust and predictability

Current problem:

- agent tooling is increasingly judged on safety, determinism, and legibility
- Cartograph already has good foundations here, but this is not visible enough

Near-term fix:

- emphasize:
  - deterministic code paths
  - explicit export paths
  - user-cache-first artifacts
  - no implicit repo writes
  - compact defaults for small repos
- add one “How Cartograph behaves” section to the site and README

Definition of done:

- the tool feels safe and boring in the best possible way

---

## Product Milestones

### Milestone A: Guided default product

- compact small-repo analysis by default
- README and site updated around command hierarchy
- homepage examples point to real packets and briefs
- benchmark suite documented as proof, not just infrastructure

### Milestone B: Packet-first experience

- packet presets are documented as primary workflows
- packet outputs include clearer next-step guidance
- add one markdown or HTML “packet viewer” for human inspection

### Milestone C: Product evidence

- curated benchmark scorecards for at least 4 public repos
- one short comparison against direct-read/manual survey workflows
- one or two real-world walkthroughs

### Milestone D: Competitive polish

- human-first summary mode for `analyze`
- clearer install decision guide
- stronger plugin and MCP discovery copy
- consistent versioning, release notes, and example freshness across all public surfaces

---

## Recommended Next Build Order

1. Finish the small-repo compact output change and document it publicly.
2. Add a command hierarchy section to the README and quickstart.
3. Generate and publish curated benchmark outputs for 3-4 repos.
4. Add a human-first `analyze` summary mode or compact terminal summary.
5. Add packet-type examples and “what to do next” guidance.
6. Build a simple HTML or markdown viewer for packets and briefs.
7. Rework the homepage headline and CTA around task packets.

---

## Product Readiness Criteria

Cartograph is product-polish ready when:

- the first-run path is obvious
- small repos do not feel worse than direct reads
- task packets are clearly the hero feature
- the README and site describe one coherent workflow
- benchmark evidence is visible to non-developers
- install/distribution choices are easy to understand
- the tool feels safe, deterministic, and unsurprising

Until then, the project can still look like a strong technical artifact with product wrapping instead of a finished product.
