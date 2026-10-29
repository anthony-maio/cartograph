# Cartograph for Hermes

Map a local repository and retrieve source excerpts for a concrete coding task.
The plugin registers `cartograph_analyze` and `cartograph_context` through
Hermes's public tool API. It requires Hermes 0.22.2 or newer and Node 20 or newer.

## Install

Install the external runtime from npm:

```sh
npm install -g @anthony-maio/cartograph@1.3.0
```

The package can install and configure the plugin directly:

```sh
cartograph install hermes
cartograph doctor hermes
hermes plugins enable cartograph
```

Alternatively, let Hermes manage the pinned plugin source. Copy the full
40-character commit from the Cartograph 1.3.0 GitHub release and use it in place
of `FULL_COMMIT_SHA`:

```sh
hermes plugins install anthony-maio/cartograph/assets/hermes --ref FULL_COMMIT_SHA --no-enable
hermes config set plugins.entries.cartograph.settings.node_path /absolute/path/to/node
hermes config set plugins.entries.cartograph.settings.cli_path /absolute/npm/root/@anthony-maio/cartograph/dist/cli.cjs
hermes plugins enable cartograph
```

Find the global package root with `npm root -g`. Paths must refer to files in
the same OS as Hermes; use Linux paths for Hermes in WSL. Keep the installed
runtime in place. Start a new chat after enabling the plugin. Use one installer
for the plugin directory: the product installer preserves directories owned
by Hermes instead of replacing them.

The optional runtime settings take precedence over the product installer's
`runtime.json`. No package is installed or downloaded during a tool call.
Catalog submission is separate from acceptance; the Git source command works
before a catalog entry is merged.

## Use

```text
Use cartograph_analyze and cartograph_context on /absolute/path/to/my/repo.
Find the code and tests that validate CLI provider names and require API keys.
Cite the source files and line ranges. Do not change files.
```

Context selection is static and lexical, with dependency relationships. Inspect
the returned excerpts and truncation flags before relying on them. The plugin
does not edit a repository or call an LLM itself.

## Settings

Settings belong under `plugins.entries.cartograph.settings` in the active
Hermes profile. `node_path` and `cli_path` are required together for a
Hermes-managed source installation. `allowed_roots` optionally restricts local
repositories to absolute directories; an empty list denies all repositories.
`timeout_seconds` defaults to 120 and accepts 5 through 300.
`max_output_chars` defaults to 40000 and accepts 4000 through 100000.

## Behavior and access

- Runs the installed Node executable and Cartograph CLI as an argument list,
  without a shell. Child output and execution time are bounded.
- Reads the requested local repository, including source outside the plugin
  directory. Resolved-path checks reject repository symlink escapes.
- Stores analysis and source excerpts in the active profile's plugin data
  directory for configured runtimes, or `cache/cartograph` for the product
  installer. Uninstall preserves caches.
- Makes no model API or intentional web requests in static mode. It reads
  local Git information as part of repository analysis.
- Returned source enters the Hermes conversation and can be sent to Hermes's
  configured model provider. Treat repository contents as untrusted data.
- Uses no credentials or credential stores, strips credentials from the child
  environment, sends no telemetry, and starts no persistent background service.
- Uses public `ctx.register_tool`, `ctx.get_config`, and `ctx.state.data_dir`.
  It does not override Hermes core functions or built-in tools.

The external npm runtime and its dependencies are installed explicitly by the
user. The plugin does not update itself. Hermes-managed updates follow pinned
source revisions; update the external runtime explicitly when required.

## Verification

The repository includes host-independent contract tests and a real Hermes
acceptance harness at `scripts/hermes-smoke.py`. The release checks also test
the installed npm package and a normal Hermes chat on a real repository.

Run the catalog gate against a clean checkout of this directory:

```sh
hermes plugins validate /path/to/cartograph/assets/hermes --install-deps
```

See the [full setup guide](https://github.com/anthony-maio/cartograph/blob/main/docs/examples/hermes.md)
and [release history](https://github.com/anthony-maio/cartograph/releases).
