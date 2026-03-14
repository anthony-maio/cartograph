# Release Checklist

Use this checklist before tagging or publishing a Cartograph release.

## Required

- Run `npm test`
- Run `npm run check`
- Run `npm run build`
- Run `npm run pack:smoke`
- Confirm the packed tarball includes `dist`, `assets`, `README.md`, and the legal docs
- Review `cartograph doctor --json` output for obvious path or asset regressions
- Confirm install adapters still place Claude, OpenClaw, and MCP assets in the documented user locations

## Publishing Decision

- Registry package name selected: `@anthony-maio/cartograph`
- Keep the executable name as `cartograph`
- Publish with public access enabled in `package.json`

## Docs and Community

- Confirm `README.md` matches the current command surface and install flow
- Confirm `CONTRIBUTING.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md` are present and current
- Confirm any new bundled skills or agents are described in `README.md`
