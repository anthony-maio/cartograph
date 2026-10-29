# Changelog

## 1.3.0 - 2026-10-29

- Add native Hermes tools for local repository analysis and task-focused source
  context, with install, doctor, and uninstall support.
- Return bounded source excerpts around task matches with accurate line ranges.
  Prioritize relevant source filenames and symbols alongside dependency context.
- Exclude tracked symlinks that escape the repository from analysis.
- Verify plugin behavior through the real Hermes loader and dispatcher, plus a
  normal chat against a real repository.
- Include Hermes contract checks in the npm publication workflow.

The Hermes integration uses local static analysis. Its returned source enters
the Hermes conversation; static matching does not guarantee complete task
coverage. See [the setup guide](docs/examples/hermes.md) for configuration and
the [verification record](docs/validation/hermes-2026-10-28.md) for evidence.
