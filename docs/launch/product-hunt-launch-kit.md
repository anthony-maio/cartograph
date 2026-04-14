# Product Hunt Launch Kit

## Primary submission URL

- `https://cartograph.making-minds.ai/launch/`

## Supporting proof URLs

- `https://cartograph.making-minds.ai/`
- `https://cartograph.making-minds.ai/examples/index.html`
- `https://cartograph.making-minds.ai/examples/benchmarks.html`
- `https://cartograph.making-minds.ai/launch/assets/index.html`
- `https://www.npmjs.com/package/@anthony-maio/cartograph`
- `https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.anthony-maio/cartograph`

## Tagline

`Turn any repo into task-shaped context for coding agents`

## Short description

`Open-source repo analysis for coding agents. Cartograph maps the repo, builds a typed task packet, and loads only the context the next agent needs. CLI first, MCP optional, with Claude Code and OpenClaw paths included.`

## Maker first comment

I built Cartograph because every coding agent workflow I watched wasted context on repo orientation before doing useful work.

The goal is simple: map the repo, build a task packet for the actual job, then load the minimum context needed for that job.

This release is centered on `analyze -> packet -> context`. Cartograph is live today as a CLI, an optional MCP server, a Claude Code plugin path, and an OpenClaw skill path, all riding on the same core analysis engine.

The site also includes public benchmark scorecards plus a real `llama.cpp` task packet and DeepWiki-style brief so people can inspect the outputs instead of trusting screenshots.

I'm most interested in feedback on where packets still drift in large repos, what repo shapes should be benchmarked next, and what would make the handoff from packet to actual coding work tighter.

## Gallery storyboard

### Slide 01 - Problem

- Headline: `Most coding agents waste context on repo orientation`
- Support: `They read too many files, miss the real wiring, and spend the first half of the session figuring out what matters.`
- Visual: strong headline slide with one short pain statement

### Slide 02 - Workflow

- Headline: `Analyze -> Packet -> Context`
- Support: `Cartograph maps the repo, builds a typed task packet, and loads the smallest useful working set for the next agent.`
- Visual: three-step workflow frame

### Slide 03 - Analyze

- Headline: `Start with a human-readable repo map`
- Support: `Summary-first static analysis surfaces what matters, dependency hubs, and the next command to run.`
- Visual: screenshot of summary-first `analyze --static`

### Slide 04 - Packet

- Headline: `Build a reusable working artifact for the actual job`
- Support: `Bug-fix, PR review, trace-flow, and change-request packets stay focused on likely edit surfaces, risks, and validation targets.`
- Visual: screenshot from `llama.cpp` packet

### Slide 05 - Proof

- Headline: `Back it up with benchmarks and real artifacts`
- Support: `Use the public benchmark scorecards plus the real llama.cpp task packet and DeepWiki-style brief.`
- Visual: benchmark scorecards or examples page

### Slide 06 - Distribution

- Headline: `Live now across the surfaces people already use`
- Support: `npm, Claude Code, OpenClaw, GitHub, and the official MCP Registry all point back to the same product surface.`
- Visual: distribution/proof frame with logos or badges

## Asset checklist

- Square thumbnail for Product Hunt
- 4-6 gallery images pulled from the launch page storyboard
- One short demo video showing `analyze -> packet -> context`
- Maker comment ready in clipboard
- Launch page verified on desktop and mobile
- Example artifact links verified
- npm / GitHub / MCP Registry links verified

## Generated asset files

- `site/launch/assets/thumbnail.png`
- `site/launch/assets/gallery-01-problem.png`
- `site/launch/assets/gallery-02-workflow.png`
- `site/launch/assets/gallery-03-analyze.png`
- `site/launch/assets/gallery-04-packet.png`
- `site/launch/assets/gallery-05-proof.png`
- `site/launch/assets/gallery-06-distribution.png`

Render them with:

```bash
node scripts/render-launch-assets.mjs
```
