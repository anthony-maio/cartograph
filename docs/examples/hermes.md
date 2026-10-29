# Cartograph in Hermes

Cartograph gives Hermes two native tools: `cartograph_analyze` returns ranked files and dependency hubs, and `cartograph_context` returns source excerpts for a coding task. Both run static analysis on an existing local directory. They require Node 20 or newer and do not call a model provider or download packages during a tool call.

The Hermes adapter is included in `@anthony-maio/cartograph` 1.3.0 and newer.

## Install in the Hermes environment

Run these commands in the same OS environment as Hermes:

```sh
npm install -g @anthony-maio/cartograph@1.3.0
cartograph install hermes
hermes plugins enable cartograph
cartograph doctor hermes
```

For Hermes in WSL, run the commands inside WSL with Linux Node. Use paths such as `/mnt/d/Development/cartograph` when referring to a Windows drive. A Windows Node path recorded by an installation outside WSL will not work inside Hermes.

Restart an existing Hermes session after enabling the plugin. The installer binds the plugin to the Node executable and Cartograph CLI used during installation. Keep that installation in place. After moving it or changing the Node installation, rerun `cartograph install hermes` and `cartograph doctor hermes`.

Installation copies a directory plugin into `HERMES_HOME/plugins/cartograph`, defaulting to `~/.hermes/plugins/cartograph`. `CARTOGRAPH_HERMES_HOME` can select an installation destination, but Hermes itself uses `HERMES_HOME`; use the same directory for installation and enablement. For a named profile, set `HERMES_HOME` to that profile's home for both commands. The installer leaves existing Hermes configuration alone. It refuses an unowned plugin directory or modified managed files instead of overwriting them.

The [official Hermes plugin guide](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins) describes native discovery and enablement. Cartograph uses the public registration context and has no Python package dependencies.

## Optional: let Hermes manage the plugin checkout

Hermes 0.22.2 or newer can install the plugin directory directly from its public
repository. Install Cartograph 1.3.0 from npm first, then use this path when you
want Hermes to own plugin updates. The native plugin has its own version,
`0.1.0`, separate from the npm package version.

Replace `FULL_COMMIT_SHA` with the full 40-character commit shown on the
[Cartograph 1.3.0 release](https://github.com/anthony-maio/cartograph/releases/tag/v1.3.0).
Replace both absolute-path examples with the Node executable and npm-installed
`dist/cli.cjs` on your machine before running these commands. The placeholders
are not executable setup values.

```sh
hermes plugins install anthony-maio/cartograph/assets/hermes --ref FULL_COMMIT_SHA --no-enable
hermes config set plugins.entries.cartograph.settings.node_path /absolute/path/to/node
hermes config set plugins.entries.cartograph.settings.cli_path /absolute/path/to/node_modules/@anthony-maio/cartograph/dist/cli.cjs
hermes plugins enable cartograph
```

Use paths in the same OS environment as Hermes. `npm root -g` identifies the
global `node_modules` directory; append `@anthony-maio/cartograph/dist/cli.cjs`
for the CLI setting. Neither plugin loading nor tool execution downloads a
runtime or installs npm packages.

Choose one installation method for a profile. A Hermes-managed checkout has
different ownership from files copied by `cartograph install hermes`; do not
run the package installer over a Hermes-managed checkout. Manage that checkout
with Hermes' plugin commands. Its cache uses the profile's plugin data
directory. See the [standalone plugin guide](../../assets/hermes/README.md) for
runtime configuration, permissions, and catalog details.

## Use it on this repository

Give Hermes a concrete task and a local checkout path:

```text
Use cartograph_analyze and cartograph_context on /mnt/d/Development/cartograph.
Find where the CLI rejects unknown LLM providers and requires API keys.
Show the relevant implementation and tests, with file and line references.
Do not change files.
```

The context should include the CLI validation logic and its tests. Excerpts include source line locations and a truncation flag. A file match alone is not proof that it contains the relevant behavior. The tool uses lexical matching and dependency relationships; inspect the source and refine the task with module, symbol, or filename terms when needed.

`repo` must be an absolute local directory. `top` defaults to 6 and accepts 1 through 20. Repository URLs, missing directories, unexpected arguments, and invalid limits return structured errors. Source excerpts are bounded; truncation is explicit.

## Profile settings and cached source

Optional settings belong in the selected Hermes profile's configuration:

```yaml
plugins:
  enabled:
    - cartograph
  entries:
    cartograph:
      settings:
        allowed_roots:
          - /mnt/d/Development
        timeout_seconds: 120
        max_output_chars: 40000
```

Merge these fields with existing configuration; do not replace an existing plugin list. With no `allowed_roots`, the tools accept any explicitly supplied local directory readable by the Hermes process. If configured, roots are resolved before checking containment, including symlinks. An empty allowlist is rejected.

The package-installed adapter writes analysis artifacts, including source excerpts, to the profile's `cache/cartograph` directory. A Hermes-managed checkout uses a `cache` directory within its profile-specific plugin data directory. These are local files, and returned context enters the Hermes conversation. An external model used by Hermes may receive that context even though Cartograph itself makes no model request. Uninstalling the plugin preserves the cache. Remove it separately when you no longer need the artifacts.

## Verify the native integration

`cartograph doctor hermes` checks files copied by the package installer and
their runtime bindings. For a Hermes-managed checkout, use
`hermes plugins doctor cartograph --ci`. Native host discovery and useful tool
output require a separate check:

```sh
python3 scripts/hermes-smoke.py --help
```

The script accepts the installed Hermes launcher and source paths, a Node executable, a built Cartograph CLI, and this repository as the acceptance target. It creates an isolated profile, runs Hermes plugin doctor, loads the real host tool registry, dispatches both tools, and checks the returned source against the repository. It also checks invalid-path errors, cache isolation, and plugin unload. It does not test a model's autonomous choice to use the tools.

For a Hermes managed installation, use its existing runtime and pass a temporary-profile parent under the installation's `profiles` directory. The script disables lazy dependency installation. It does not install packages into Hermes or modify existing profiles. The verification report records the tested host revision and repository revision.

## Disable or remove a package-installed adapter

```sh
hermes plugins disable cartograph
cartograph uninstall hermes
```

Use the same profile and OS environment as installation. Restart existing sessions after disabling. Uninstall removes unchanged managed plugin files and preserves configuration, source caches, and user-added files. If a managed file was edited, move or restore it before uninstalling.
