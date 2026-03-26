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
