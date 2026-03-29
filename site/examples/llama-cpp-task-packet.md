# bug-fix: Fix the Dots OCR adapter bug in tools/mtmd/models/dots_ocr.cpp and the GGUF conversion path in convert_hf_to_gguf.py.

> Repo: llama.cpp | Confidence: 0.95

## Key Files

- `tools/mtmd/models/dots_ocr.cpp` — Matches task terms: dots, ocr, mtmd
- `convert_hf_to_gguf.py` — Matches task terms: gguf, convert
- `gguf-py/gguf/gguf.py` — Matches task terms: gguf
- `models/dots.ocr/modeling_dots_ocr_vllm.py` — Matches task terms: dots, ocr
- `convert_llama_ggml_to_gguf.py` — Matches task terms: gguf, convert
- `models/dots.ocr/config.json` — Matches task terms: dots, ocr

## Dependency Hubs

- `gguf-py/gguf/gguf.py` — shared dependency (18 inbound, 1 outbound)
- `tools/mtmd/models/models.h` — shared dependency (2 inbound, 0 outbound)

## Entry Points

- `tools/mtmd/models/dots_ocr.cpp`
- `convert_hf_to_gguf.py`
- `gguf-py/gguf/gguf.py`

## Minimal Context

- `tools/mtmd/models/dots_ocr.cpp` — Matches task terms: dots, ocr, mtmd
- `convert_hf_to_gguf.py` — Matches task terms: gguf, convert
- `gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py` — Matches task terms: dots, ocr, gguf, convert
- `gguf-py/gguf/gguf.py` — Matches task terms: gguf

## Validation Targets

- `gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py` — Matches task terms: dots, ocr, gguf, convert

## Risks

- Changes near `gguf-py/gguf/gguf.py` may fan out widely because it is a high fan-in dependency.
- The packet includes entry-point files, so wiring regressions may affect a broad surface area.

## Recommended Next Steps

- Inspect `tools/mtmd/models/dots_ocr.cpp` first.
- Read `convert_hf_to_gguf.py` next to confirm the surrounding wiring.
- Use `gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py` as the first validation target.
- Reproduce the issue against the top candidate test or the nearest affected module before editing.

## Details

```json
{
  "reproductionClues": [
    "Task terms detected: dots, ocr, mtmd, gguf, conversion, convert.",
    "Start around `tools/mtmd/models/dots_ocr.cpp` because it ranked highest for this task.",
    "Use `gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py` to confirm or reproduce behavior quickly.",
    "Watch `gguf-py/gguf/gguf.py` for shared dependency effects while reproducing."
  ],
  "suspectedFaultSites": [
    "tools/mtmd/models/dots_ocr.cpp",
    "convert_hf_to_gguf.py",
    "gguf-py/gguf/gguf.py"
  ],
  "candidateTests": [
    "gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py"
  ]
}
```
