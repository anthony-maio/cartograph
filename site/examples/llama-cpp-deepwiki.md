# llama.cpp: DeepWiki-Style Repo Brief

`llama.cpp` is a mixed C/C++, Python, and TypeScript repository built around one core job: run and package LLM inference across a wide spread of local hardware and tool surfaces. The center of gravity is the native runtime in `src/` and `ggml/`, but the repo also contains a Python-based GGUF conversion toolchain, multimodal adapters, an HTTP server, and a full Svelte web UI.

Cartograph's static pass over the local checkout found:

- 1,549 files
- 306 dependency edges
- major language groups: C/C++, TypeScript/Svelte, Python, and Markdown/docs

## High-Level Map

The repository breaks down into a few clear layers:

- `src/`
  The main `llama.cpp` runtime and model-serving core. This is where model loading, inference context, sampling, KV cache management, and graph execution logic live.
- `ggml/src/`
  The lower-level tensor and backend layer. This is the compute substrate underneath `llama.cpp`, including backend registration, quantization support, and GGUF handling.
- `gguf-py/`
  The Python library and scripts for reading, writing, and inspecting GGUF files. This is the key bridge between Hugging Face-style model artifacts and runtime-consumable GGUF output.
- `tools/`
  User-facing utilities and product surfaces: CLI tools, quantizers, server entrypoints, MTMD multimodal utilities, RPC support, benchmarking, and the Svelte-based WebUI.
- `models/`
  Model-specific assets, templates, and auxiliary configuration used by conversion or multimodal flows.
- `examples/`
  Small focused programs and workflows showing how the runtime, conversion pipeline, and server pieces fit together.

## Core Runtime Layer

The core runtime is concentrated in `src/`. A good mental model is:

- `llama.cpp`, `llama-model.cpp`, `llama-model-loader.cpp`
  Model loading and runtime ownership
- `llama-context.cpp`, `llama-batch.cpp`, `llama-graph.cpp`
  Execution state and graph orchestration
- `llama-sampler.cpp`, `llama-chat.cpp`, `llama-grammar.cpp`
  Sampling, chat templating, and structured generation helpers
- `llama-kv-cache*.cpp`, `llama-memory*.cpp`
  KV cache and memory strategies

This layer is where you land when a bug is about inference behavior, model execution semantics, caching, or runtime wiring.

## Backend and Tensor Substrate

`ggml/src/` is the engine room underneath the higher-level runtime.

Important files include:

- `ggml.c` / `ggml.cpp`
- `ggml-backend.cpp`
- `ggml-backend-reg.cpp`
- `ggml-quants.c`
- `gguf.cpp`

This is where low-level tensor behavior, quantization details, backend dispatch, and GGUF-level format handling come together. If a change touches performance, tensor layouts, backend portability, or binary model format internals, it usually crosses this boundary.

## GGUF Conversion Pipeline

The Python conversion path is one of the most important secondary systems in the repo.

The main conversion workflow centers on:

- `convert_hf_to_gguf.py`
- `gguf-py/gguf/gguf.py`
- `gguf-py/gguf/gguf_reader.py`
- `gguf-py/gguf/gguf_writer.py`
- `gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py`

This pipeline is how model definitions from upstream ecosystems get translated into the GGUF format consumed by the runtime. Bugs here are often not isolated: they tend to span converter logic, GGUF schema handling, and model-family-specific edge cases.

## Multimodal and MTMD Adapters

The multimodal stack is concentrated in `tools/mtmd/`.

Key areas:

- `tools/mtmd/mtmd.cpp`
- `tools/mtmd/models/*.cpp`
- `tools/mtmd/models/models.h`
- `tools/mtmd/legacy-models/*.py`

This is the most relevant subsystem for Dots OCR. The adapter itself lives in:

- `tools/mtmd/models/dots_ocr.cpp`

The important design pattern here is model-family specialization. The shared MTMD infrastructure provides the common shell, but each model adapter carries its own wiring and assumptions. That makes adapter bugs highly local at first, but they often propagate outward into conversion or shared GGUF handling once you trace the full path.

## Server and Web UI

The repository is not just a library/runtime. It also ships an HTTP/server surface and a substantial front-end application.

Important paths:

- `tools/server/`
- `tools/server/webui/`
- `tools/server/webui/src/lib/stores/*.svelte.ts`
- `tools/server/webui/src/lib/components/`

This layer is relevant when changes affect serving behavior, remote inference workflows, model selection, or browser-facing configuration. In Cartograph's static importance scoring, several `tools/server/webui` files rank highly because they export a lot of stateful surface area.

## Dots OCR Bug Walkthrough

For the Dots OCR adapter issue, the strongest packet Cartograph produced centered on:

- `tools/mtmd/models/dots_ocr.cpp`
- `convert_hf_to_gguf.py`
- `gguf-py/gguf/gguf.py`
- `gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py`

That is the right working set because the bug is not just “inside one adapter.” It sits on the boundary between:

1. model-family-specific MTMD logic
2. Python conversion logic
3. shared GGUF handling
4. the exact Dots OCR regression test

If you were debugging or reviewing this path manually, that is the minimum plausible context worth opening first.

## Where To Start By Task

For common work, start here:

- New runtime/inference issue:
  `src/` first, then `ggml/src/` if the behavior smells like backend or tensor handling
- New GGUF conversion bug:
  `convert_hf_to_gguf.py`, then `gguf-py/`, then the nearest model-family test
- New multimodal adapter bug:
  `tools/mtmd/models/<model>.cpp`, then `models.h`, then converter/test surfaces
- Server or product-facing issue:
  `tools/server/` and `tools/server/webui/`

## Practical Read of the Repo

The repo is broad, but not directionless. The real architecture is:

- native inference core
- tensor/backend substrate
- model-format conversion pipeline
- model-family adapters
- server and UI surfaces layered on top

That is why task packets help here. Without them, a model-adapter bug can easily send an agent wandering into WebUI state stores, generic README files, or unrelated utility scripts. With a focused packet, the working set collapses to the adapter, the converter, the shared GGUF layer, and the exact validation target.

## Related Artifacts

- Task packet markdown: [llama-cpp-task-packet.md](./llama-cpp-task-packet.md)
- Task packet JSON: [llama-cpp-task-packet.json](./llama-cpp-task-packet.json)
- Raw static export: [llama-cpp-static-wiki.md](./llama-cpp-static-wiki.md)
