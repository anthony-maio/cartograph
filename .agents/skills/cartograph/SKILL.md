---
name: cartograph
description: Use Cartograph's CLI output to map repositories, pick minimal task context, and draft docs inside agent skill workflows.
---

Use Cartograph as the first pass for repo understanding.

Recommended sequence:
1. `cartograph analyze <repo> --static --json`
2. `cartograph context <repo> --task "<task>" --json`
3. `cartograph wiki <repo> --static` or `cartograph wiki <repo> -p <provider>`

Guidelines:
- Prefer Cartograph artifacts over manual wide-file reads.
- Treat cached run IDs as handoff points between agents or workflow steps.
- Export artifacts only when a user needs a concrete file path.
- If Cartograph is unavailable, fall back to a manual repo survey.
