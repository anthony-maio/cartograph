# Find the refresh-token boundary

This small repository gives Cartograph a concrete investigation: find the code and tests for a refresh-token expiry issue without pulling billing and catalog code into the handoff. It needs Node.js 20 or newer and no API credentials, services, or additional packages.

The sample is already correct. Its tests capture the behavior you would preserve while investigating a bug: convert milliseconds to seconds, reject a token at the expiry boundary, and reject a revoked session. Cartograph locates the files; the tests determine whether their behavior is correct.

From this directory, using Cartograph 1.2.1 or newer:

```sh
cartograph analyze . --static
cartograph packet . --type bug-fix --task "fix refresh token expiry"
cartograph context . --task "fix refresh token expiry" --static --json
node --test tests/auth-refresh.test.js
```

Look for `src/auth/refresh.js` in the packet's `keyFiles` and `tests/auth-refresh.test.js` in `validationTargets`. The context result should include those files and the clock helper they use. Billing and catalog code should stay outside the selected context. The three checks should pass.

The static path uses file names, exports, dependencies, and task terms. Treat its selections as investigation leads, then read the code and run the tests. Model-backed context selection is available separately when you omit `--static` and configure a provider.
