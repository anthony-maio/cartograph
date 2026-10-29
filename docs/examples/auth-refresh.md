# A useful first run: investigate refresh-token expiry

Use this example to verify the installed package before connecting Cartograph to a coding host. You will get a repository map, a task packet identifying the likely implementation and test, and a small context bundle containing the code to inspect. No model API key is needed.

## Install the published package locally

Use Node.js 20 or newer. Run these commands in a new working directory:

```sh
npm init -y
npm install @anthony-maio/cartograph@1.3.0
npx cartograph --version
```

The example ships inside the package at `node_modules/@anthony-maio/cartograph/examples/auth-refresh`. Keeping it in the archive means the release check can exercise exactly what a new user receives.

## Map, investigate, and load the relevant code

```sh
npx cartograph analyze ./node_modules/@anthony-maio/cartograph/examples/auth-refresh --static
npx cartograph packet ./node_modules/@anthony-maio/cartograph/examples/auth-refresh --type bug-fix --task "fix refresh token expiry"
npx cartograph context ./node_modules/@anthony-maio/cartograph/examples/auth-refresh --task "fix refresh token expiry" --static --json
```

In the packet, inspect `keyFiles`, `minimalContext`, and `validationTargets`. The implementation is `src/auth/refresh.js`; its test is `tests/auth-refresh.test.js`. The context command includes their source and the `src/clock.js` dependency. Billing and catalog files are unrelated to this task and should not appear in the context bundle.

The implementation accepts a millisecond clock while the session stores expiry in Unix seconds. A missing conversion would reject a still-valid session. The test also covers the exact expiry boundary and revocation.

## Run the behavioral checks

```sh
node --test ./node_modules/@anthony-maio/cartograph/examples/auth-refresh/tests/auth-refresh.test.js
```

Expected result: three passing tests. The example is already correct; this verifies the behavior a bug fix must preserve. Cartograph does not execute the tests for you or prove that a selected file contains the bug.

## Apply the same workflow to your repository

Replace the example path and task with your own. Inspect the selected files before giving them to a coding tool. Use `--output context.json` to save the result if you need a portable handoff. Successful runs also create cached artifacts; their locations are printed to stderr.

`--static` uses local heuristics without model calls. Omitting it selects the separate model-backed workflow and requires provider configuration, such as `CARTOGRAPH_API_KEY` for a hosted provider or `--provider ollama` for a configured local model. The small example proves installation and the basic workflow, not selection quality across every repository.
