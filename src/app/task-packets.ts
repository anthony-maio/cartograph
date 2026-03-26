import * as path from "node:path";
import type { DependencyEdge, FileNode } from "../schema";

export type TaskPacketType = "task" | "bug-fix" | "pr-review" | "trace-flow" | "change-request";

export interface TaskPacketFileRef {
  path: string;
  reason: string;
  importanceScore: number;
  relevanceScore: number;
}

export interface TaskPacketDependencyHub {
  path: string;
  inboundCount: number;
  outboundCount: number;
  role: string;
}

export interface TaskPacketValidationTarget {
  path: string;
  reason: string;
}

export interface BaseTaskPacket<TDetails> {
  taskType: TaskPacketType;
  taskSummary: string;
  repoId: string;
  repoName: string;
  generatedAt: string;
  keyFiles: TaskPacketFileRef[];
  dependencyHubs: TaskPacketDependencyHub[];
  entryPoints: string[];
  minimalContext: TaskPacketFileRef[];
  constraints: string[];
  unknowns: string[];
  risks: string[];
  recommendedNextSteps: string[];
  validationTargets: TaskPacketValidationTarget[];
  artifacts: string[];
  confidence: number;
  details: TDetails;
}

export interface GenericTaskPacketDetails {
  focusAreas: string[];
}

export interface BugFixPacketDetails {
  reproductionClues: string[];
  suspectedFaultSites: string[];
  candidateTests: string[];
}

export interface PrReviewPacketDetails {
  changedFiles: string[];
  blastRadius: string[];
  reviewChecklist: string[];
  testGaps: string[];
}

export interface TraceFlowPacketDetails {
  startPoints: string[];
  pathCandidates: string[];
  branchPoints: string[];
  sideEffects: string[];
}

export interface ChangeRequestPacketDetails {
  likelyEditSurfaces: string[];
  relatedModules: string[];
  migrationConcerns: string[];
}

export type TaskPacket =
  | BaseTaskPacket<GenericTaskPacketDetails>
  | BaseTaskPacket<BugFixPacketDetails>
  | BaseTaskPacket<PrReviewPacketDetails>
  | BaseTaskPacket<TraceFlowPacketDetails>
  | BaseTaskPacket<ChangeRequestPacketDetails>;

export interface BuildTaskPacketOptions {
  repoId: string;
  repoName: string;
  taskType: TaskPacketType;
  taskSummary: string;
  files: FileNode[];
  edges: DependencyEdge[];
  changedFiles?: string[];
  generatedAt?: string;
}

interface HubStats {
  inboundCount: number;
  outboundCount: number;
}

interface RankedFile {
  file: FileNode;
  relevanceScore: number;
  reason: string;
  matchedTokens: string[];
}

const STOP_WORDS = new Set([
  "a", "an", "and", "the", "for", "from", "with", "into", "onto", "that", "this", "these", "those",
  "task", "change", "changes", "request", "review", "trace", "flow", "fix", "bug", "issue", "problem",
  "add", "new", "build", "packet", "generate", "generation", "update", "improve", "repo", "code",
]);

const ENTRY_POINT_PATTERNS = [/^index\./, /^main\./, /^app\./, /^server\./, /^cli\./, /^mod\./];

export function buildTaskPacket(opts: BuildTaskPacketOptions): TaskPacket {
  const changedFiles = new Set((opts.changedFiles ?? []).map(normalizePath));
  const tokens = extractTaskTokens(opts.taskSummary);
  const hubs = computeHubStats(opts.edges);
  const neighborMap = buildNeighborMap(opts.edges);
  const rankedFiles = opts.files
    .map((file) => rankFile(file, tokens, changedFiles, hubs, neighborMap, opts.taskType))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const keyFiles = rankedFiles.filter((candidate) => !isTestFile(candidate.file.path)).slice(0, 6).map(toFileRef);
  const minimalContext = rankedFiles.slice(0, 4).map(toFileRef);
  const dependencyHubs = selectDependencyHubs(opts.files, hubs, rankedFiles);
  const entryPoints = selectEntryPoints(opts.files, rankedFiles, opts.taskType);
  const validationTargets = selectValidationTargets(opts.files, tokens, keyFiles, changedFiles);

  const base = {
    taskType: opts.taskType,
    taskSummary: opts.taskSummary,
    repoId: opts.repoId,
    repoName: opts.repoName,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    keyFiles,
    dependencyHubs,
    entryPoints,
    minimalContext,
    constraints: buildConstraints(dependencyHubs, entryPoints),
    unknowns: buildUnknowns(opts.taskType, rankedFiles, changedFiles, entryPoints),
    risks: buildRisks(opts.taskType, keyFiles, dependencyHubs, entryPoints, validationTargets, changedFiles),
    recommendedNextSteps: buildRecommendedNextSteps(opts.taskType, keyFiles, validationTargets),
    validationTargets,
    artifacts: ["task-packet"],
    confidence: estimateConfidence(rankedFiles, validationTargets, changedFiles),
  };

  switch (opts.taskType) {
    case "bug-fix":
      return {
        ...base,
        details: {
          reproductionClues: buildReproductionClues(tokens, keyFiles, validationTargets, dependencyHubs),
          suspectedFaultSites: keyFiles.slice(0, 3).map((file) => file.path),
          candidateTests: validationTargets.map((target) => target.path),
        },
      };
    case "pr-review":
      return {
        ...base,
        details: {
          changedFiles: Array.from(changedFiles),
          blastRadius: buildBlastRadius(changedFiles, neighborMap, dependencyHubs),
          reviewChecklist: [
            "Check changed files for contract or API shifts.",
            "Review nearby high-fan-in modules for hidden regressions.",
            "Confirm tests cover the changed surface and its nearest dependencies.",
            "Look for entry-point or configuration changes that widen blast radius.",
          ],
          testGaps: validationTargets.length > 0
            ? []
            : ["No obvious test targets matched the changed files or task summary."],
        },
      };
    case "trace-flow":
      return {
        ...base,
        details: {
          startPoints: entryPoints.slice(0, 3),
          pathCandidates: buildPathCandidates(entryPoints, minimalContext, neighborMap),
          branchPoints: dependencyHubs.filter((hub) => hub.outboundCount > 1).slice(0, 4).map((hub) => hub.path),
          sideEffects: buildSideEffects(minimalContext.map((file) => file.path)),
        },
      };
    case "change-request":
      return {
        ...base,
        details: {
          likelyEditSurfaces: keyFiles.slice(0, 4).map((file) => file.path),
          relatedModules: collectRelatedModules(keyFiles.map((file) => file.path)),
          migrationConcerns: buildMigrationConcerns(entryPoints, dependencyHubs, validationTargets),
        },
      };
    case "task":
    default:
      return {
        ...base,
        details: {
          focusAreas: keyFiles.slice(0, 4).map((file) => file.path),
        },
      };
  }
}

function rankFile(
  file: FileNode,
  tokens: string[],
  changedFiles: Set<string>,
  hubs: Map<string, HubStats>,
  neighborMap: Map<string, Set<string>>,
  taskType: TaskPacketType,
): RankedFile {
  const normalizedPath = normalizePath(file.path);
  const haystack = `${normalizedPath} ${file.exports.join(" ")} ${file.imports.join(" ")}`.toLowerCase();
  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  const hubStats = hubs.get(normalizedPath) ?? { inboundCount: 0, outboundCount: 0 };

  let relevanceScore = file.importanceScore;
  const reasons: string[] = [];

  if (matchedTokens.length > 0) {
    relevanceScore += matchedTokens.length * 18;
    reasons.push(`Matches task terms: ${matchedTokens.join(", ")}`);
  }

  if (changedFiles.has(normalizedPath)) {
    relevanceScore += 40;
    reasons.push("Explicit changed file");
  }

  if (hubStats.inboundCount + hubStats.outboundCount > 0) {
    relevanceScore += Math.min(hubStats.inboundCount + hubStats.outboundCount, 12);
    reasons.push(hubStats.inboundCount >= hubStats.outboundCount ? "High fan-in dependency hub" : "Wiring/orchestration hub");
  }

  if (isEntryPoint(file.path)) {
    relevanceScore += taskType === "trace-flow" ? 24 : 6;
    reasons.push("Entry-point file");
  }

  if (isTestFile(file.path)) {
    relevanceScore += taskType === "bug-fix" || taskType === "pr-review" ? 8 : -10;
    reasons.push("Validation target");
  }

  if (taskType === "pr-review" && !changedFiles.has(normalizedPath)) {
    const neighbors = neighborMap.get(normalizedPath) ?? new Set<string>();
    if (Array.from(changedFiles).some((changed) => neighbors.has(changed))) {
      relevanceScore += 14;
      reasons.push("Adjacent to changed file");
    }
  }

  if (reasons.length === 0) {
    reasons.push(`Structurally important file (score ${file.importanceScore})`);
  }

  return {
    file,
    relevanceScore,
    reason: reasons[0],
    matchedTokens,
  };
}

function toFileRef(candidate: RankedFile): TaskPacketFileRef {
  return {
    path: candidate.file.path,
    reason: candidate.reason,
    importanceScore: candidate.file.importanceScore,
    relevanceScore: candidate.relevanceScore,
  };
}

function computeHubStats(edges: DependencyEdge[]): Map<string, HubStats> {
  const stats = new Map<string, HubStats>();
  for (const edge of edges) {
    const from = normalizePath(edge.from);
    const to = normalizePath(edge.to);
    const fromStats = stats.get(from) ?? { inboundCount: 0, outboundCount: 0 };
    fromStats.outboundCount += 1;
    stats.set(from, fromStats);
    const toStats = stats.get(to) ?? { inboundCount: 0, outboundCount: 0 };
    toStats.inboundCount += 1;
    stats.set(to, toStats);
  }
  return stats;
}

function buildNeighborMap(edges: DependencyEdge[]): Map<string, Set<string>> {
  const neighbors = new Map<string, Set<string>>();
  for (const edge of edges) {
    const from = normalizePath(edge.from);
    const to = normalizePath(edge.to);
    const fromNeighbors = neighbors.get(from) ?? new Set<string>();
    fromNeighbors.add(to);
    neighbors.set(from, fromNeighbors);
    const toNeighbors = neighbors.get(to) ?? new Set<string>();
    toNeighbors.add(from);
    neighbors.set(to, toNeighbors);
  }
  return neighbors;
}

function selectDependencyHubs(files: FileNode[], hubs: Map<string, HubStats>, rankedFiles: RankedFile[]): TaskPacketDependencyHub[] {
  const topRanked = new Set(rankedFiles.slice(0, 10).map((candidate) => normalizePath(candidate.file.path)));
  return files
    .map((file) => {
      const stats = hubs.get(normalizePath(file.path)) ?? { inboundCount: 0, outboundCount: 0 };
      return {
        path: file.path,
        inboundCount: stats.inboundCount,
        outboundCount: stats.outboundCount,
        role: describeHubRole(stats),
        score: stats.inboundCount + stats.outboundCount + (topRanked.has(normalizePath(file.path)) ? 5 : 0),
      };
    })
    .filter((hub) => hub.inboundCount + hub.outboundCount > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _score, ...hub }) => hub);
}

function selectEntryPoints(files: FileNode[], rankedFiles: RankedFile[], taskType: TaskPacketType): string[] {
  const explicit = files.filter((file) => isEntryPoint(file.path)).sort((a, b) => b.importanceScore - a.importanceScore).map((file) => file.path);
  if (explicit.length > 0) {
    return explicit.slice(0, taskType === "trace-flow" ? 4 : 3);
  }
  return rankedFiles.filter((candidate) => !isTestFile(candidate.file.path)).slice(0, 3).map((candidate) => candidate.file.path);
}

function selectValidationTargets(files: FileNode[], tokens: string[], keyFiles: TaskPacketFileRef[], changedFiles: Set<string>): TaskPacketValidationTarget[] {
  const keyStems = new Set(keyFiles.map((file) => fileStem(file.path)));
  return files
    .filter((file) => isTestFile(file.path))
    .map((file) => {
      const normalizedPath = normalizePath(file.path).toLowerCase();
      let score = 0;
      const reasons: string[] = [];
      const matchedTokens = tokens.filter((token) => normalizedPath.includes(token));
      if (matchedTokens.length > 0) {
        score += matchedTokens.length * 10;
        reasons.push(`Matches task terms: ${matchedTokens.join(", ")}`);
      }
      for (const stem of keyStems) {
        if (stem && normalizedPath.includes(stem.toLowerCase())) {
          score += 12;
          reasons.push(`Covers key file stem: ${stem}`);
          break;
        }
      }
      if (Array.from(changedFiles).some((changed) => normalizedPath.includes(fileStem(changed).toLowerCase()))) {
        score += 15;
        reasons.push("Likely covers changed file");
      }
      return { path: file.path, reason: reasons[0] ?? "Nearby test surface", score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _score, ...target }) => target);
}

function buildRisks(
  taskType: TaskPacketType,
  keyFiles: TaskPacketFileRef[],
  dependencyHubs: TaskPacketDependencyHub[],
  entryPoints: string[],
  validationTargets: TaskPacketValidationTarget[],
  changedFiles: Set<string>,
): string[] {
  const risks: string[] = [];
  const hotHub = dependencyHubs.find((hub) => keyFiles.some((file) => file.path === hub.path) && hub.inboundCount >= 2);
  if (hotHub) {
    risks.push(`Changes near \`${hotHub.path}\` may fan out widely because it is a high fan-in dependency.`);
  }
  if (entryPoints.some((entry) => keyFiles.some((file) => file.path === entry))) {
    risks.push("The packet includes entry-point files, so wiring regressions may affect a broad surface area.");
  }
  if (validationTargets.length === 0) {
    risks.push("No obvious validation targets matched the packet; manual verification may be required.");
  }
  if (taskType === "pr-review" && changedFiles.size > 4) {
    risks.push("This review touches several files, so blast radius may be broader than the top-ranked files suggest.");
  }
  return risks;
}

function buildUnknowns(taskType: TaskPacketType, rankedFiles: RankedFile[], changedFiles: Set<string>, entryPoints: string[]): string[] {
  const unknowns: string[] = [];
  if (!rankedFiles.some((candidate) => candidate.matchedTokens.length > 0)) {
    unknowns.push("The task summary did not strongly match repository names, so ranking leans on structural importance.");
  }
  if (taskType === "pr-review" && changedFiles.size === 0) {
    unknowns.push("No explicit changed files were provided, so blast radius is inferred from the task summary.");
  }
  if (taskType === "trace-flow" && entryPoints.length > 1) {
    unknowns.push("Multiple plausible entry points exist, so the exact runtime path may need confirmation.");
  }
  return unknowns;
}

function buildConstraints(dependencyHubs: TaskPacketDependencyHub[], entryPoints: string[]): string[] {
  const constraints = [
    "Prefer focused edits around the minimal context before widening scope.",
    "Treat high-fan-in modules as high-blast-radius surfaces.",
  ];
  if (entryPoints.length > 0) {
    constraints.push("Confirm entry-point wiring before changing shared dependencies.");
  }
  if (dependencyHubs.length === 0) {
    constraints.push("Dependency hub data is sparse, so validate assumptions directly in the selected files.");
  }
  return constraints;
}

function buildRecommendedNextSteps(taskType: TaskPacketType, keyFiles: TaskPacketFileRef[], validationTargets: TaskPacketValidationTarget[]): string[] {
  const steps = [
    `Inspect \`${keyFiles[0]?.path ?? "the top-ranked file"}\` first.`,
    `Read \`${keyFiles[1]?.path ?? keyFiles[0]?.path ?? "the next-ranked file"}\` next to confirm the surrounding wiring.`,
  ];
  if (validationTargets[0]) {
    steps.push(`Use \`${validationTargets[0].path}\` as the first validation target.`);
  }
  if (taskType === "pr-review") {
    steps.push("Review changed files before walking outward into their nearest hubs.");
  } else if (taskType === "trace-flow") {
    steps.push("Follow the highest-ranked entry point hop by hop before reading leaf modules.");
  } else if (taskType === "bug-fix") {
    steps.push("Reproduce the issue against the top candidate test or the nearest affected module before editing.");
  }
  return steps;
}

function estimateConfidence(rankedFiles: RankedFile[], validationTargets: TaskPacketValidationTarget[], changedFiles: Set<string>): number {
  const matchedFiles = rankedFiles.filter((candidate) => candidate.matchedTokens.length > 0).length;
  let confidence = 0.35;
  confidence += Math.min(matchedFiles, 4) * 0.1;
  confidence += Math.min(validationTargets.length, 2) * 0.08;
  confidence += Math.min(changedFiles.size, 2) * 0.06;
  if (matchedFiles === 0) {
    confidence -= 0.12;
  }
  return Math.max(0.12, Math.min(0.95, Number(confidence.toFixed(2))));
}

function buildReproductionClues(tokens: string[], keyFiles: TaskPacketFileRef[], validationTargets: TaskPacketValidationTarget[], dependencyHubs: TaskPacketDependencyHub[]): string[] {
  const clues: string[] = [];
  if (tokens.length > 0) {
    clues.push(`Task terms detected: ${tokens.join(", ")}.`);
  }
  if (keyFiles[0]) {
    clues.push(`Start around \`${keyFiles[0].path}\` because it ranked highest for this task.`);
  }
  if (validationTargets[0]) {
    clues.push(`Use \`${validationTargets[0].path}\` to confirm or reproduce behavior quickly.`);
  }
  if (dependencyHubs[0]) {
    clues.push(`Watch \`${dependencyHubs[0].path}\` for shared dependency effects while reproducing.`);
  }
  return clues;
}

function buildBlastRadius(changedFiles: Set<string>, neighborMap: Map<string, Set<string>>, dependencyHubs: TaskPacketDependencyHub[]): string[] {
  const blast = new Set<string>();
  for (const changedFile of changedFiles) {
    blast.add(changedFile);
    for (const neighbor of neighborMap.get(changedFile) ?? []) {
      blast.add(neighbor);
    }
  }
  for (const hub of dependencyHubs.slice(0, 3)) {
    blast.add(hub.path);
  }
  return Array.from(blast).slice(0, 8);
}

function buildPathCandidates(entryPoints: string[], minimalContext: TaskPacketFileRef[], neighborMap: Map<string, Set<string>>): string[] {
  const paths: string[] = [];
  for (const entryPoint of entryPoints.slice(0, 2)) {
    const neighbors = Array.from(neighborMap.get(normalizePath(entryPoint)) ?? []).slice(0, 2);
    if (neighbors.length === 0 && minimalContext[0]) {
      paths.push(`${entryPoint} -> ${minimalContext[0].path}`);
      continue;
    }
    for (const neighbor of neighbors) {
      paths.push(`${entryPoint} -> ${neighbor}`);
    }
  }
  return paths.length > 0 ? paths.slice(0, 5) : minimalContext.slice(0, 2).map((file) => file.path);
}

function buildSideEffects(paths: string[]): string[] {
  const effects = new Set<string>();
  for (const filePath of paths) {
    const lower = filePath.toLowerCase();
    if (lower.includes("db") || lower.includes("store")) {
      effects.add("Database or persistence side effects are likely in the selected path.");
    }
    if (lower.includes("config") || lower.includes("env")) {
      effects.add("Configuration or environment wiring may affect this flow.");
    }
    if (lower.includes("api") || lower.includes("http") || lower.includes("route")) {
      effects.add("Request/response boundaries may shape the observed behavior.");
    }
  }
  return Array.from(effects).slice(0, 4);
}

function collectRelatedModules(filePaths: string[]): string[] {
  const modules = new Set<string>();
  for (const filePath of filePaths) {
    const dirName = path.posix.dirname(normalizePath(filePath));
    if (dirName && dirName !== ".") {
      modules.add(dirName);
    }
  }
  return Array.from(modules).slice(0, 5);
}

function buildMigrationConcerns(entryPoints: string[], dependencyHubs: TaskPacketDependencyHub[], validationTargets: TaskPacketValidationTarget[]): string[] {
  const concerns: string[] = [];
  if (entryPoints.length > 0) {
    concerns.push("Entry-point changes may require careful rollout or smoke testing.");
  }
  if (dependencyHubs.some((hub) => hub.inboundCount >= 2)) {
    concerns.push("Shared dependencies may require compatibility checks before widening changes.");
  }
  if (validationTargets.length === 0) {
    concerns.push("No obvious test coverage surfaced for the likely edit points.");
  }
  return concerns;
}

function describeHubRole(stats: HubStats): string {
  if (stats.inboundCount >= stats.outboundCount * 2 && stats.inboundCount > 0) {
    return "shared dependency";
  }
  if (stats.outboundCount >= stats.inboundCount * 2 && stats.outboundCount > 0) {
    return "orchestrator";
  }
  return "connector";
}

function extractTaskTokens(summary: string): string[] {
  const tokens = summary
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  return Array.from(new Set(tokens)).slice(0, 8);
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isTestFile(filePath: string): boolean {
  return /(^|\/)(__tests__|tests?)\//.test(normalizePath(filePath)) || /\.(test|spec)\.[^.]+$/i.test(filePath);
}

function isEntryPoint(filePath: string): boolean {
  const baseName = path.posix.basename(normalizePath(filePath));
  return ENTRY_POINT_PATTERNS.some((pattern) => pattern.test(baseName));
}

function fileStem(filePath: string): string {
  const baseName = path.posix.basename(normalizePath(filePath));
  return baseName.replace(/\.(test|spec)\.[^.]+$/i, "").replace(/\.[^.]+$/, "");
}
