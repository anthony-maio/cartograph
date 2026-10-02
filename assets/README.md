# Host assets

The same skills and agents ship in a few places on purpose. They are not copies of each other, each one is tuned for how that host reaches Cartograph.

| Location | Installed by | Tuned for |
| --- | --- | --- |
| `assets/claude/` | `cartograph install claude` | CLI first (`cartograph analyze ...`), since the CLI is on PATH |
| `plugins/cartograph/` | Claude Code plugin marketplace | MCP first, using the MCP server bundled with the plugin, with `npx` for CLI-only commands |
| `assets/openclaw/` | `cartograph install openclaw` | OpenClaw, plus the OpenProse workflows |
| `.claude/skills/` | nothing, this is the repo's own dev setup | must stay an exact copy of `assets/claude/skills` |

When you change the behavior a skill describes, update every variant that covers it. `tests/release/asset-sync.test.ts` enforces the one exact-copy pair.
