import test from "node:test";
import assert from "node:assert/strict";
import { buildTaskPacket } from "../../src/app/task-packets.ts";
import type { DependencyEdge, FileNode } from "../../src/schema.ts";

const files: FileNode[] = [
  {
    path: "src/app.ts",
    language: "typescript",
    lines: 120,
    bytes: 3200,
    imports: ["./auth/controller", "./db/client"],
    exports: [],
    importanceScore: 88,
  },
  {
    path: "src/auth/controller.ts",
    language: "typescript",
    lines: 90,
    bytes: 2600,
    imports: ["./service"],
    exports: ["loginHandler"],
    importanceScore: 91,
  },
  {
    path: "src/auth/service.ts",
    language: "typescript",
    lines: 140,
    bytes: 4200,
    imports: ["../db/client"],
    exports: ["loginUser", "refreshSession"],
    importanceScore: 96,
  },
  {
    path: "src/db/client.ts",
    language: "typescript",
    lines: 110,
    bytes: 3500,
    imports: [],
    exports: ["db"],
    importanceScore: 84,
  },
  {
    path: "tests/auth/service.test.ts",
    language: "typescript",
    lines: 70,
    bytes: 1800,
    imports: ["../../src/auth/service"],
    exports: [],
    importanceScore: 42,
  },
];

const edges: DependencyEdge[] = [
  { from: "src/app.ts", to: "src/auth/controller.ts" },
  { from: "src/app.ts", to: "src/db/client.ts" },
  { from: "src/auth/controller.ts", to: "src/auth/service.ts" },
  { from: "src/auth/service.ts", to: "src/db/client.ts" },
  { from: "tests/auth/service.test.ts", to: "src/auth/service.ts" },
];

test("buildTaskPacket emits shared fields and bug-fix details", () => {
  const packet = buildTaskPacket({
    repoId: "sample-repo",
    repoName: "sample-repo",
    taskType: "bug-fix",
    taskSummary: "Fix the login bug in auth session refresh",
    files,
    edges,
  });

  assert.equal(packet.taskType, "bug-fix");
  assert.equal(packet.taskSummary, "Fix the login bug in auth session refresh");
  assert.equal(packet.repoId, "sample-repo");
  assert.ok(packet.generatedAt);
  assert.ok(packet.keyFiles.some((file) => file.path === "src/auth/service.ts"));
  assert.ok(packet.dependencyHubs.some((hub) => hub.path === "src/auth/service.ts"));
  assert.ok(packet.validationTargets.some((target) => target.path === "tests/auth/service.test.ts"));
  assert.ok(packet.details.reproductionClues.length > 0);
  assert.ok(packet.details.suspectedFaultSites.includes("src/auth/service.ts"));
  assert.ok(packet.details.candidateTests.includes("tests/auth/service.test.ts"));
  assert.ok(packet.confidence > 0.4);
});

test("buildTaskPacket emits pr-review overlays and respects explicit changed files", () => {
  const packet = buildTaskPacket({
    repoId: "sample-repo",
    repoName: "sample-repo",
    taskType: "pr-review",
    taskSummary: "Review the auth login changes",
    files,
    edges,
    changedFiles: ["src/auth/service.ts", "src/auth/controller.ts"],
  });

  assert.equal(packet.taskType, "pr-review");
  assert.deepEqual(packet.details.changedFiles, [
    "src/auth/service.ts",
    "src/auth/controller.ts",
  ]);
  assert.ok(packet.keyFiles.some((file) => file.path === "src/auth/controller.ts"));
  assert.ok(packet.details.blastRadius.some((path) => path === "src/db/client.ts"));
  assert.ok(packet.details.reviewChecklist.length >= 3);
});

test("buildTaskPacket keeps bug-fix packets focused on explicit code changes instead of docs and unrelated hubs", () => {
  const llamaLikeFiles: FileNode[] = [
    {
      path: "tools/mtmd/models/dots_ocr.cpp",
      language: "cpp",
      lines: 220,
      bytes: 7600,
      imports: [],
      exports: [],
      importanceScore: 0,
    },
    {
      path: "convert_hf_to_gguf.py",
      language: "python",
      lines: 4300,
      bytes: 120000,
      imports: ["gguf.gguf"],
      exports: ["DotsOCRVisionModel"],
      importanceScore: 58,
    },
    {
      path: "gguf-py/gguf/gguf.py",
      language: "python",
      lines: 900,
      bytes: 28000,
      imports: [],
      exports: ["GGUFWriter"],
      importanceScore: 52,
    },
    {
      path: "gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py",
      language: "python",
      lines: 110,
      bytes: 4200,
      imports: ["convert_hf_to_gguf"],
      exports: [],
      importanceScore: 32,
    },
    {
      path: "gguf-py/tests/test_quants.py",
      language: "python",
      lines: 180,
      bytes: 6400,
      imports: ["gguf-py/gguf/gguf.py"],
      exports: [],
      importanceScore: 30,
    },
    {
      path: "gguf-py/tests/test_metadata.py",
      language: "python",
      lines: 170,
      bytes: 6100,
      imports: ["gguf-py/gguf/gguf.py"],
      exports: [],
      importanceScore: 28,
    },
    {
      path: "gguf-py/tests/__init__.py",
      language: "python",
      lines: 5,
      bytes: 120,
      imports: [],
      exports: [],
      importanceScore: 4,
    },
    {
      path: "models/dots.ocr/README.md",
      language: "markdown",
      lines: 140,
      bytes: 5200,
      imports: [],
      exports: [],
      importanceScore: 60,
    },
    {
      path: "artifacts/dotsocr-src/README.md",
      language: "markdown",
      lines: 95,
      bytes: 3000,
      imports: [],
      exports: [],
      importanceScore: 60,
    },
    {
      path: "tools/server/webui/src/lib/components/ui/sidebar/constants.ts",
      language: "typescript",
      lines: 210,
      bytes: 6000,
      imports: [],
      exports: ["SIDEBAR_ITEMS"],
      importanceScore: 68,
    },
    {
      path: "tools/server/webui/src/lib/stores/models.svelte.ts",
      language: "typescript",
      lines: 260,
      bytes: 7200,
      imports: ["../components/ui/sidebar/constants"],
      exports: ["modelsStore"],
      importanceScore: 70,
    },
    {
      path: "tools/mtmd/legacy-models/minicpmv-convert-image-encoder-to-gguf.py",
      language: "python",
      lines: 210,
      bytes: 6800,
      imports: ["gguf-py/gguf/gguf.py"],
      exports: ["convertMiniCpmvImageEncoder"],
      importanceScore: 66,
    },
    {
      path: "tools/mtmd/legacy-models/glmedge-convert-image-encoder-to-gguf.py",
      language: "python",
      lines: 225,
      bytes: 7100,
      imports: ["gguf-py/gguf/gguf.py"],
      exports: ["convertGlmEdgeImageEncoder"],
      importanceScore: 64,
    },
  ];

  const llamaLikeEdges: DependencyEdge[] = [
    { from: "convert_hf_to_gguf.py", to: "gguf-py/gguf/gguf.py" },
    { from: "gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py", to: "convert_hf_to_gguf.py" },
    { from: "gguf-py/tests/test_quants.py", to: "gguf-py/gguf/gguf.py" },
    { from: "gguf-py/tests/test_metadata.py", to: "gguf-py/gguf/gguf.py" },
    { from: "tools/server/webui/src/lib/stores/models.svelte.ts", to: "tools/server/webui/src/lib/components/ui/sidebar/constants.ts" },
    { from: "tools/mtmd/legacy-models/minicpmv-convert-image-encoder-to-gguf.py", to: "gguf-py/gguf/gguf.py" },
    { from: "tools/mtmd/legacy-models/glmedge-convert-image-encoder-to-gguf.py", to: "gguf-py/gguf/gguf.py" },
  ];

  const packet = buildTaskPacket({
    repoId: "llama-like-repo",
    repoName: "llama-like-repo",
    taskType: "bug-fix",
    taskSummary: "Fix the tools/mtmd/models/dots_ocr.cpp adapter bug and the DotsOCR GGUF conversion path in convert_hf_to_gguf.py",
    files: llamaLikeFiles,
    edges: llamaLikeEdges,
    changedFiles: [
      "tools/mtmd/models/dots_ocr.cpp",
      "convert_hf_to_gguf.py",
      "gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py",
    ],
  });

  assert.deepEqual(
    packet.keyFiles.slice(0, 2).map((file) => file.path).sort(),
    ["convert_hf_to_gguf.py", "tools/mtmd/models/dots_ocr.cpp"],
  );
  assert.deepEqual(
    packet.minimalContext.slice(0, 2).map((file) => file.path).sort(),
    ["convert_hf_to_gguf.py", "tools/mtmd/models/dots_ocr.cpp"],
  );
  assert.ok(packet.keyFiles.some((file) => file.path === "convert_hf_to_gguf.py"));
  assert.ok(!packet.keyFiles.some((file) => file.path.includes("tools/server/webui")));
  assert.ok(!packet.keyFiles.some((file) => file.path.includes("legacy-models")));
  assert.ok(!packet.keyFiles.some((file) => file.path.includes("/gguf/scripts/")));
  assert.ok(packet.details.suspectedFaultSites.includes("convert_hf_to_gguf.py"));
  assert.ok(packet.details.suspectedFaultSites.includes("tools/mtmd/models/dots_ocr.cpp"));
  assert.ok(packet.validationTargets.some((target) => target.path === "gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py"));
  assert.equal(packet.validationTargets[0]?.path, "gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py");
  assert.ok(!packet.validationTargets.some((target) => target.path === "gguf-py/tests/__init__.py"));
  assert.ok(!packet.validationTargets.some((target) => target.path === "gguf-py/tests/test_quants.py"));
  assert.ok(!packet.details.suspectedFaultSites.some((path) => path.endsWith("README.md")));
  assert.ok(!packet.dependencyHubs.some((hub) => hub.path.includes("tools/server/webui")));
  assert.ok(!packet.dependencyHubs.some((hub) => hub.path.includes("legacy-models")));
});

test("buildTaskPacket hydrates explicit changed files even when static analysis omitted them", () => {
  const packet = buildTaskPacket({
    repoId: "oversized-repo",
    repoName: "oversized-repo",
    taskType: "bug-fix",
    taskSummary: "Fix the oversized converter bug",
    files: [
      {
        path: "src/adapter.ts",
        language: "typescript",
        lines: 90,
        bytes: 2800,
        imports: [],
        exports: ["runAdapter"],
        importanceScore: 40,
      },
      {
        path: "tests/adapter.test.ts",
        language: "typescript",
        lines: 70,
        bytes: 2000,
        imports: ["../src/adapter"],
        exports: [],
        importanceScore: 20,
      },
    ],
    edges: [
      { from: "tests/adapter.test.ts", to: "src/adapter.ts" },
    ],
    changedFiles: ["src/adapter.ts", "scripts/oversized-converter.py"],
  });

  assert.ok(packet.keyFiles.some((file) => file.path === "scripts/oversized-converter.py"));
  assert.ok(packet.minimalContext.some((file) => file.path === "scripts/oversized-converter.py"));
  assert.ok(packet.details.suspectedFaultSites.includes("scripts/oversized-converter.py"));
});

test("buildTaskPacket prefers shared dependencies over generic utility scripts when sparse graphs hide direct change neighbors", () => {
  const sparseFiles: FileNode[] = [
    {
      path: "tools/mtmd/models/dots_ocr.cpp",
      language: "cpp",
      lines: 220,
      bytes: 7600,
      imports: [],
      exports: [],
      importanceScore: 0,
    },
    {
      path: "convert_hf_to_gguf.py",
      language: "python",
      lines: 4300,
      bytes: 120000,
      imports: [],
      exports: ["DotsOCRVisionModel"],
      importanceScore: 0,
    },
    {
      path: "models/dots.ocr/modeling_dots_ocr_vllm.py",
      language: "python",
      lines: 410,
      bytes: 9600,
      imports: [],
      exports: ["DotsOCRModel"],
      importanceScore: 20,
    },
    {
      path: "gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py",
      language: "python",
      lines: 110,
      bytes: 4200,
      imports: [],
      exports: [],
      importanceScore: 3,
    },
    {
      path: "gguf-py/gguf/gguf.py",
      language: "python",
      lines: 900,
      bytes: 28000,
      imports: [],
      exports: ["GGUFWriter"],
      importanceScore: 50,
    },
    {
      path: "gguf-py/gguf/constants.py",
      language: "python",
      lines: 140,
      bytes: 3600,
      imports: [],
      exports: ["GGUF_CONSTANTS"],
      importanceScore: 24,
    },
    {
      path: "gguf-py/gguf/scripts/gguf_convert_endian.py",
      language: "python",
      lines: 180,
      bytes: 5200,
      imports: ["gguf-py/gguf/gguf.py"],
      exports: ["convertEndian"],
      importanceScore: 20,
    },
    {
      path: "gguf-py/gguf/scripts/gguf_hash.py",
      language: "python",
      lines: 160,
      bytes: 4800,
      imports: ["gguf-py/gguf/gguf.py"],
      exports: ["hashGguf"],
      importanceScore: 20,
    },
    {
      path: "examples/llama.android/lib/src/main/cpp/logging.h",
      language: "cpp",
      lines: 120,
      bytes: 3200,
      imports: [],
      exports: ["AndroidLogger"],
      importanceScore: 18,
    },
    {
      path: "examples/llama.android/lib/src/main/cpp/jni.cpp",
      language: "cpp",
      lines: 210,
      bytes: 6200,
      imports: ["examples/llama.android/lib/src/main/cpp/logging.h"],
      exports: ["registerJni"],
      importanceScore: 12,
    },
    {
      path: "examples/llama.android/lib/src/main/cpp/context.cpp",
      language: "cpp",
      lines: 240,
      bytes: 7000,
      imports: ["examples/llama.android/lib/src/main/cpp/logging.h"],
      exports: ["createContext"],
      importanceScore: 12,
    },
  ];

  const sparseEdges: DependencyEdge[] = [
    { from: "gguf-py/gguf/scripts/gguf_convert_endian.py", to: "gguf-py/gguf/gguf.py" },
    { from: "gguf-py/gguf/scripts/gguf_convert_endian.py", to: "gguf-py/gguf/constants.py" },
    { from: "gguf-py/gguf/scripts/gguf_hash.py", to: "gguf-py/gguf/gguf.py" },
    { from: "gguf-py/gguf/scripts/gguf_hash.py", to: "gguf-py/gguf/constants.py" },
    { from: "examples/llama.android/lib/src/main/cpp/jni.cpp", to: "examples/llama.android/lib/src/main/cpp/logging.h" },
    { from: "examples/llama.android/lib/src/main/cpp/context.cpp", to: "examples/llama.android/lib/src/main/cpp/logging.h" },
  ];

  const packet = buildTaskPacket({
    repoId: "sparse-llama-like-repo",
    repoName: "sparse-llama-like-repo",
    taskType: "bug-fix",
    taskSummary: "Fix the tools/mtmd/models/dots_ocr.cpp adapter bug and the DotsOCR GGUF conversion path in convert_hf_to_gguf.py",
    files: sparseFiles,
    edges: sparseEdges,
    changedFiles: [
      "tools/mtmd/models/dots_ocr.cpp",
      "convert_hf_to_gguf.py",
      "gguf-py/tests/test_convert_hf_to_gguf_dots_ocr.py",
    ],
  });

  assert.ok(packet.dependencyHubs.some((hub) => hub.path === "gguf-py/gguf/gguf.py"));
  assert.ok(!packet.dependencyHubs.some((hub) => hub.path === "gguf-py/gguf/scripts/gguf_convert_endian.py"));
  assert.ok(!packet.dependencyHubs.some((hub) => hub.path === "gguf-py/gguf/scripts/gguf_hash.py"));
  assert.ok(!packet.dependencyHubs.some((hub) => hub.path === "examples/llama.android/lib/src/main/cpp/logging.h"));
  assert.ok(!packet.keyFiles.some((file) => file.path === "gguf-py/gguf/scripts/gguf_convert_endian.py"));
  assert.ok(!packet.keyFiles.some((file) => file.path === "gguf-py/gguf/scripts/gguf_hash.py"));
  assert.ok(!packet.keyFiles.some((file) => file.path === "examples/llama.android/lib/src/main/cpp/logging.h"));
});
