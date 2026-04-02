# Task Packet Benchmark Scorecards

These scorecards turn the public benchmark suite into a product-facing readout. The point is not just whether Cartograph can emit a packet. The point is whether the packet is useful enough to change what a developer or coding agent reads next.

## Summary

Cartograph is strongest today when:

- the task is concrete
- the repo has clear source boundaries
- the packet type is specific
- there are obvious changed files, entry points, or tests to anchor on

Cartograph is weaker today when:

- repo vocabulary is broad and ambiguous
- trace-flow validation targets mostly live in fixtures
- the most visible path tokens are not the real runtime path

## Scorecards

### `llama.cpp` bug-fix

- Outcome: strong
- Why it works:
  - surfaces the exact adapter file `tools/mtmd/models/dots_ocr.cpp`
  - keeps `convert_hf_to_gguf.py` in the working set
  - identifies the exact validation target `gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py`
- What this proves:
  - focused bug-fix packets can stay on mixed C++ and Python bug surfaces without drifting into docs or unrelated UI files

### `fastapi` bug-fix

- Outcome: good with caveats
- Why it works:
  - prioritizes framework source files like `fastapi/dependencies/models.py`
  - keeps dependency and exception surfaces visible
- Remaining weakness:
  - validation targeting still drifts toward less relevant tests than the task deserves
- What this proves:
  - source-side focus is solid, but test targeting still needs more framework-specific refinement

### `next.js` trace-flow

- Outcome: good with caveats
- Why it works:
  - packet stays on router and route surfaces
  - avoids the worst fixture and helper drift that earlier versions showed
- Remaining weakness:
  - the first validation targets are still e2e pages and fixtures rather than the most legible runtime checkpoints
- What this proves:
  - trace-flow packets can survive a large monorepo, but route-level validation heuristics still need tuning

### `open-webui` task

- Outcome: useful but not clean enough yet
- Why it works:
  - backend state and redis surfaces rank highly
  - frontend API/constants files stay visible in the minimal context
- Remaining weakness:
  - the packet still admits generic structural files like `README.md`
- What this proves:
  - multi-surface application repos benefit from task packets, but broad “task” packets still need stronger non-code filtering

## Takeaway

The benchmark suite already shows a product worth using:

- small repos: Cartograph should stay compact and get out of the way
- medium repos: `packet` and `context` start saving real time
- large repos: `analyze` becomes triage, and task packets become the handoff layer

The most important next refinements are:

1. better validation-target ranking for trace-flow and framework-heavy bug-fix tasks
2. stronger non-code filtering in broad task packets
3. more human-facing benchmark presentation on the site
