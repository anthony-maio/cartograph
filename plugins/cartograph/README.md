# Cartograph Claude Plugin

Cartograph's Claude Code plugin bundles:

- a plugin-scoped Cartograph MCP server
- three slash commands: `/cartograph:analyze`, `/cartograph:context`, `/cartograph:wiki`
- two skills: `use-cartograph` and `repo-surveyor`
- five documentation-oriented agents

Install from the marketplace rooted at this repository:

```text
/plugin marketplace add anthony-maio/cartograph
/plugin install cartograph@making-minds-tools
```

The plugin prefers the bundled MCP server for repo analysis and falls back to `npx -y @anthony-maio/cartograph ...` when the full CLI surface is needed for `context` or `wiki`.
