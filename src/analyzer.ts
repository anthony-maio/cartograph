import simpleGit from "simple-git";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { FileNode, DependencyEdge } from "./schema";

// Language detection by extension
const LANG_MAP: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
  ".mjs": "javascript", ".cjs": "javascript", ".py": "python", ".go": "go",
  ".rs": "rust", ".java": "java", ".kt": "kotlin", ".rb": "ruby",
  ".php": "php", ".c": "c", ".cpp": "cpp", ".cc": "cpp", ".h": "c", ".hpp": "cpp",
  ".cs": "csharp", ".swift": "swift", ".scala": "scala", ".dart": "dart",
  ".vue": "vue", ".svelte": "svelte", ".md": "markdown", ".json": "json",
  ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".sql": "sql",
  ".sh": "shell", ".bash": "shell", ".zsh": "shell", ".dockerfile": "docker",
  ".graphql": "graphql", ".gql": "graphql", ".proto": "protobuf",
  ".css": "css", ".scss": "scss", ".less": "less", ".html": "html",
};

// Directories to skip
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__", ".cache",
  "vendor", "target", ".idea", ".vscode", "coverage", ".nyc_output",
  "venv", ".venv", "env", ".env", ".tox", "eggs", ".eggs",
  "bower_components", "jspm_packages", ".nuxt", ".output",
  ".parcel-cache", ".turbo", ".vercel", ".svelte-kit",
]);

// Files to skip
const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
  "poetry.lock", "Gemfile.lock", "composer.lock", "go.sum",
]);

// Max file size to analyze (100KB)
const MAX_FILE_SIZE = 100 * 1024;

// JS-family import patterns. `[^'"`;]*?` spans multi-line specifier lists and
// default + named combos like `import a, { b } from "x"`.
const JS_IMPORT_PATTERNS = [
  /(?:^|[^\w$.])(?:import|export)\s+(?:type\s+)?[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /(?:^|[^\w$.])import\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

// Import regex patterns by language group
const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  typescript: JS_IMPORT_PATTERNS,
  javascript: JS_IMPORT_PATTERNS,
  vue: JS_IMPORT_PATTERNS,
  svelte: JS_IMPORT_PATTERNS,
  python: [
    /^\s*from\s+([\w.]+)\s+import/gm,
    /^\s*import\s+([\w.]+)/gm,
  ],
  go: [
    /import\s+"([^"]+)"/g,
    /import\s+\w+\s+"([^"]+)"/g,
  ],
  rust: [
    /\buse\s+([\w:]+)/g,
    /extern\s+crate\s+(\w+)/g,
  ],
  java: [
    /import\s+(?:static\s+)?([\w.]+)/g,
  ],
  kotlin: [
    /import\s+([\w.]+)/g,
  ],
  ruby: [
    /require\s+['"]([^'"]+)['"]/g,
    /require_relative\s+['"]([^'"]+)['"]/g,
  ],
  php: [
    /use\s+([\w\\]+)/g,
    /require(?:_once)?\s+['"]([^'"]+)['"]/g,
    /include(?:_once)?\s+['"]([^'"]+)['"]/g,
  ],
  csharp: [
    /using\s+([\w.]+)/g,
  ],
  c: [
    /#\s*include\s*"([^"]+)"/g,
  ],
  cpp: [
    /#\s*include\s*"([^"]+)"/g,
  ],
};

// Export regex patterns
const EXPORT_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|enum|interface|type)\s+(\w+)/g,
    /export\s+\{([^}]+)\}/g,
  ],
  javascript: [
    /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
    /export\s+\{([^}]+)\}/g,
    /module\.exports\s*=\s*(?:\{([^}]+)\}|(\w+))/g,
  ],
  python: [
    /^(?:def|class|async\s+def)\s+(\w+)/gm,
    /__all__\s*=\s*\[([^\]]+)\]/g,
  ],
  go: [
    /^func\s+([A-Z]\w*)/gm,
    /^type\s+([A-Z]\w*)/gm,
  ],
  rust: [
    /pub\s+(?:async\s+)?(?:fn|struct|enum|trait|type|const|static|mod)\s+(\w+)/g,
  ],
  java: [
    /public\s+(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:class|interface|enum|record)\s+(\w+)/g,
    /public\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/g,
  ],
};

// Entry point file patterns (higher importance)
const ENTRY_PATTERNS = [
  /^index\.\w+$/, /^main\.\w+$/, /^app\.\w+$/, /^server\.\w+$/,
  /^mod\.\w+$/, /^lib\.\w+$/, /^init\.\w+$/, /^__init__\.py$/,
  /^routes?\.\w+$/, /^router\.\w+$/, /^schema\.\w+$/, /^models?\.\w+$/,
  /^config\.\w+$/, /^settings?\.\w+$/, /^middleware\.\w+$/,
];

// Config file patterns
const CONFIG_PATTERNS = [
  /^package\.json$/, /^tsconfig.*\.json$/, /^Cargo\.toml$/,
  /^pyproject\.toml$/, /^setup\.py$/, /^go\.mod$/, /^Makefile$/,
  /^Dockerfile$/, /^docker-compose.*\.y(?:a)?ml$/, /^\.env\.example$/,
  /^README\.md$/i, /^CLAUDE\.md$/i, /^CONTRIBUTING\.md$/i,
];

const JS_RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"];

export async function cloneRepo(repoUrl: string, branch?: string): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), createCloneDirName(process.platform));
  fs.mkdirSync(tmpDir, { recursive: true });

  const git = simpleGit();
  const cloneOptions = buildCloneOptions(branch, process.platform);

  try {
    await git.clone(repoUrl, tmpDir, cloneOptions);
  } catch (err) {
    cleanupRepo(tmpDir);
    throw err;
  }
  return tmpDir;
}

export function cleanupRepo(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best effort cleanup
  }
}

export function buildCloneOptions(branch?: string, platform: NodeJS.Platform = process.platform): string[] {
  const cloneOptions = ["--depth", "1"];
  if (branch) {
    cloneOptions.push("--branch", branch);
  }
  if (platform === "win32") {
    cloneOptions.push("-c", "core.longpaths=true");
  }
  return cloneOptions;
}

export function createCloneDirName(platform: NodeJS.Platform = process.platform): string {
  const prefix = platform === "win32" ? "cg" : "cartograph";
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isIncludedPath(relativePath: string): boolean {
  const segments = relativePath.split("/");
  const fileName = segments.pop()!;
  if (SKIP_FILES.has(fileName)) return false;
  return segments.every(segment => !SKIP_DIRS.has(segment) && !segment.startsWith("."));
}

// Prefer git's view of the tree so .gitignore is respected; fall back to a
// plain walk for non-git directories or when git reports nothing.
export function listRepoFiles(repoDir: string): string[] {
  const gitFiles = listGitFiles(repoDir);
  if (gitFiles && gitFiles.length > 0) return gitFiles;
  return walkDir(repoDir);
}

function listGitFiles(repoDir: string): string[] | null {
  try {
    const output = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: repoDir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 },
    );
    return Array.from(new Set(output.split("\0").filter(Boolean))).filter(isIncludedPath);
  } catch {
    return null;
  }
}

function walkDir(repoDir: string): string[] {
  const files: string[] = [];
  const pending: string[] = [""];

  while (pending.length > 0) {
    const relativeDir = pending.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(repoDir, relativeDir), { withFileTypes: true });
    } catch {
      continue; // Skip unreadable directories
    }

    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          pending.push(relativePath);
        }
      } else if (entry.isFile() && !SKIP_FILES.has(entry.name)) {
        files.push(relativePath);
      }
    }
  }

  return files.sort();
}

export function extractImports(content: string, language: string): string[] {
  const patterns = IMPORT_PATTERNS[language];
  if (!patterns) return [];

  const imports: Set<string> = new Set();
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) imports.add(match[1].trim());
    }
  }

  if (language === "go") {
    // Grouped form: import ( "a"; alias "b" )
    for (const block of content.matchAll(/^import\s*\(([\s\S]*?)^\)/gm)) {
      for (const spec of block[1].matchAll(/"([^"]+)"/g)) imports.add(spec[1]);
    }
  }

  return Array.from(imports);
}

function extractExports(content: string, language: string): string[] {
  const patterns = EXPORT_PATTERNS[language];
  if (!patterns) return [];

  const exports: Set<string> = new Set();
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const val = match[1] || match[2];
      if (val) {
        // Handle comma-separated exports like { a, b, c }
        val.split(",").forEach(e => {
          const trimmed = e.trim().split(/\s+as\s+/).pop()?.trim();
          if (trimmed) exports.add(trimmed);
        });
      }
    }
  }
  return Array.from(exports);
}

export function analyzeFiles(repoDir: string): { files: FileNode[]; edges: DependencyEdge[] } {
  const filePaths = listRepoFiles(repoDir);
  const files: FileNode[] = [];

  // First pass: analyze each file
  for (const filePath of filePaths) {
    const fullPath = path.join(repoDir, filePath);
    const ext = path.extname(filePath).toLowerCase();
    const language = LANG_MAP[ext];

    // Skip binary/non-code files (unless config/readme)
    const basename = path.basename(filePath);
    const isConfig = CONFIG_PATTERNS.some(p => p.test(basename));

    if (!language && !isConfig) continue;

    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      if (stat.size > MAX_FILE_SIZE) continue;
      if (stat.size === 0) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n").length;

      const imports = language ? extractImports(content, language) : [];
      const exports = language ? extractExports(content, language) : [];

      files.push({
        path: filePath,
        language: language || "config",
        lines,
        bytes: stat.size,
        imports,
        exports,
        importanceScore: 0, // computed below
      });
    } catch {
      // Skip unreadable files
    }
  }

  const edges = buildDependencyEdges(repoDir, files);

  const fanInCount = new Map<string, number>(); // how many files import this file
  for (const edge of edges) {
    fanInCount.set(edge.to, (fanInCount.get(edge.to) || 0) + 1);
  }

  // Compute importance scores
  for (const file of files) {
    let score = 0;
    const basename = path.basename(file.path);

    // Entry point bonus
    if (ENTRY_PATTERNS.some(p => p.test(basename))) score += 30;

    // Config file bonus
    if (CONFIG_PATTERNS.some(p => p.test(basename))) score += 20;

    // README/docs bonus
    if (/readme/i.test(basename)) score += 40;

    // Fan-in bonus (many files import this = important)
    const fanIn = fanInCount.get(file.path) || 0;
    score += Math.min(fanIn * 10, 50);

    // Export count bonus (more exports = more API surface)
    score += Math.min(file.exports.length * 3, 20);

    // Penalize very small files
    if (file.lines < 5) score -= 10;

    // Penalize test files
    if (/\.test\.|\.spec\.|__test__|_test\./.test(file.path)) score -= 20;

    // Root-level files get a bonus
    if (!file.path.includes("/")) score += 10;

    file.importanceScore = Math.max(0, score);
  }

  // Sort by importance descending
  files.sort((a, b) => b.importanceScore - a.importanceScore);

  return { files, edges };
}

// ---------------------------------------------------------------------------
// Import resolution
// ---------------------------------------------------------------------------

interface FileIndex {
  paths: Set<string>;
  // Path suffixes without extension ("models/user", "user") -> matching files
  bySuffix: Map<string, string[]>;
  // Directory -> files directly inside it
  byDir: Map<string, string[]>;
  goModules: Array<{ modulePath: string; dir: string }>;
}

function stripExt(filePath: string): string {
  const ext = path.posix.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

function buildFileIndex(repoDir: string, files: FileNode[]): FileIndex {
  const index: FileIndex = { paths: new Set(), bySuffix: new Map(), byDir: new Map(), goModules: [] };

  for (const file of files) {
    index.paths.add(file.path);

    const segments = stripExt(file.path).split("/");
    for (let i = 0; i < segments.length; i++) {
      const suffix = segments.slice(i).join("/");
      const bucket = index.bySuffix.get(suffix) ?? [];
      bucket.push(file.path);
      index.bySuffix.set(suffix, bucket);
    }

    const dir = path.posix.dirname(file.path);
    const dirBucket = index.byDir.get(dir) ?? [];
    dirBucket.push(file.path);
    index.byDir.set(dir, dirBucket);

    if (path.posix.basename(file.path) === "go.mod") {
      try {
        const goMod = fs.readFileSync(path.join(repoDir, file.path), "utf-8");
        const modulePath = goMod.match(/^module\s+(\S+)/m)?.[1];
        if (modulePath) index.goModules.push({ modulePath, dir });
      } catch {
        // Ignore unreadable go.mod
      }
    }
  }

  return index;
}

function buildDependencyEdges(repoDir: string, files: FileNode[]): DependencyEdge[] {
  const index = buildFileIndex(repoDir, files);
  const edges: DependencyEdge[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    for (const imp of file.imports) {
      for (const target of resolveImport(imp, file.path, file.language, index)) {
        const key = `${file.path}\0${target}`;
        if (target === file.path || seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: file.path, to: target });
      }
    }
  }

  return edges;
}

function first(...candidates: Array<string | undefined>): string[] {
  const hit = candidates.find((c): c is string => c !== undefined);
  return hit ? [hit] : [];
}

function findWithExtensions(index: FileIndex, basePath: string, extensions: string[]): string | undefined {
  if (index.paths.has(basePath)) return basePath;
  return extensions.map(ext => basePath + ext).find(p => index.paths.has(p));
}

function normalizeRepoRelative(p: string): string | null {
  const normalized = path.posix.normalize(p);
  if (normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) return null;
  return normalized.replace(/^\.\//, "");
}

// Match a path suffix against the index. When several files share the suffix,
// prefer the one closest to the importing file; give up if that is still ambiguous.
function findBySuffix(index: FileIndex, suffix: string, fromFile: string, allowedExts?: string[]): string | undefined {
  let candidates = index.bySuffix.get(suffix) ?? [];
  if (allowedExts) {
    candidates = candidates.filter(c => allowedExts.includes(path.posix.extname(c)));
  }
  if (candidates.length <= 1) return candidates[0];

  const fromSegments = fromFile.split("/");
  const shared = (candidate: string) => {
    const segments = candidate.split("/");
    let n = 0;
    while (n < segments.length && n < fromSegments.length && segments[n] === fromSegments[n]) n++;
    return n;
  };
  const ranked = candidates.map(c => ({ c, n: shared(c) })).sort((a, b) => b.n - a.n);
  return ranked[0].n > ranked[1].n ? ranked[0].c : undefined;
}

function resolveImport(importPath: string, fromFile: string, language: string, index: FileIndex): string[] {
  const fromDir = path.posix.dirname(fromFile);

  switch (language) {
    case "typescript":
    case "javascript":
    case "vue":
    case "svelte": {
      let base: string | null;
      if (importPath.startsWith(".")) {
        base = normalizeRepoRelative(path.posix.join(fromDir, importPath));
      } else if (importPath.startsWith("@/") || importPath.startsWith("~/")) {
        // Common alias for the source root
        const rest = importPath.slice(2);
        return first(
          findWithExtensions(index, `src/${rest}`, JS_RESOLVE_EXTENSIONS),
          findWithExtensions(index, rest, JS_RESOLVE_EXTENSIONS),
          ...JS_RESOLVE_EXTENSIONS.map(ext => findWithExtensions(index, `src/${rest}/index`, [ext])),
        );
      } else {
        return []; // bare specifier = package
      }
      if (!base) return [];
      // TS sources often import "./foo.js" when the file on disk is foo.ts
      const withoutJsExt = base.replace(/\.(?:js|jsx|mjs|cjs)$/, "");
      return first(
        findWithExtensions(index, base, JS_RESOLVE_EXTENSIONS),
        findWithExtensions(index, withoutJsExt, JS_RESOLVE_EXTENSIONS),
        findWithExtensions(index, `${base}/index`, JS_RESOLVE_EXTENSIONS),
      );
    }

    case "python": {
      const leadingDots = importPath.match(/^\.*/)![0].length;
      const modulePath = importPath.slice(leadingDots).replace(/\./g, "/");
      if (leadingDots > 0) {
        let baseDir = fromDir;
        for (let i = 1; i < leadingDots; i++) baseDir = path.posix.dirname(baseDir);
        const base = normalizeRepoRelative(modulePath ? path.posix.join(baseDir, modulePath) : baseDir);
        if (!base) return [];
        return first(
          findWithExtensions(index, base, [".py"]),
          findWithExtensions(index, `${base}/__init__`, [".py"]),
        );
      }
      if (!modulePath) return [];
      // Absolute import: try the repo root, then a src/-style layout via suffix match.
      // A single-segment name only resolves next to the importer or at the root, so
      // stdlib names like `os` or `types` do not bind to random repo files.
      const direct = first(
        findWithExtensions(index, modulePath, [".py"]),
        findWithExtensions(index, `${modulePath}/__init__`, [".py"]),
      );
      if (direct.length > 0) return direct;
      if (!modulePath.includes("/")) {
        return first(findWithExtensions(index, path.posix.join(fromDir, modulePath), [".py"]));
      }
      return first(
        findBySuffix(index, modulePath, fromFile, [".py"]),
        findBySuffix(index, `${modulePath}/__init__`, fromFile, [".py"]),
      );
    }

    case "go": {
      for (const { modulePath, dir } of index.goModules) {
        if (importPath !== modulePath && !importPath.startsWith(`${modulePath}/`)) continue;
        const rest = importPath.slice(modulePath.length).replace(/^\//, "");
        const pkgDir = path.posix.normalize(dir === "." ? rest || "." : rest ? `${dir}/${rest}` : dir);
        return (index.byDir.get(pkgDir) ?? []).filter(p => p.endsWith(".go") && !p.endsWith("_test.go"));
      }
      return [];
    }

    case "rust": {
      const segments = importPath.split("::").filter(Boolean);
      const head = segments.shift();
      let baseDir: string;
      if (head === "crate") {
        const fromSegments = fromDir.split("/");
        const srcIndex = fromSegments.lastIndexOf("src");
        baseDir = srcIndex >= 0 ? fromSegments.slice(0, srcIndex + 1).join("/") : fromDir;
      } else if (head === "self" || head === "super") {
        baseDir = head === "super" ? path.posix.dirname(fromDir) : fromDir;
        while (segments[0] === "super") {
          segments.shift();
          baseDir = path.posix.dirname(baseDir);
        }
      } else {
        return []; // external crate or std
      }
      // Trailing segments may be items rather than modules; try the longest module path first
      for (let len = segments.length; len > 0; len--) {
        const base = normalizeRepoRelative(path.posix.join(baseDir, ...segments.slice(0, len)));
        if (!base) return [];
        const hit = findWithExtensions(index, base, [".rs"]) ?? findWithExtensions(index, `${base}/mod`, [".rs"]);
        if (hit) return [hit];
      }
      return [];
    }

    case "java":
    case "kotlin": {
      const exts = language === "java" ? [".java"] : [".kt"];
      const segments = importPath.split(".");
      if (segments[segments.length - 1] === "*") return [];
      // `import static a.b.C.method` -> drop trailing lowercase member names
      while (segments.length > 1 && /^[a-z_]/.test(segments[segments.length - 1]) && /^[A-Z]/.test(segments[segments.length - 2])) {
        segments.pop();
      }
      return first(findBySuffix(index, segments.join("/"), fromFile, exts));
    }

    case "ruby": {
      const relative = normalizeRepoRelative(path.posix.join(fromDir, importPath));
      return first(
        relative ? findWithExtensions(index, relative, [".rb"]) : undefined,
        findWithExtensions(index, `lib/${importPath}`, [".rb"]),
      );
    }

    case "php": {
      if (importPath.includes("\\")) {
        return first(findBySuffix(index, importPath.replace(/\\/g, "/"), fromFile, [".php"]));
      }
      const relative = normalizeRepoRelative(path.posix.join(fromDir, importPath));
      return first(relative && index.paths.has(relative) ? relative : undefined);
    }

    case "c":
    case "cpp": {
      const relative = normalizeRepoRelative(path.posix.join(fromDir, importPath));
      if (relative && index.paths.has(relative)) return [relative];
      const suffix = normalizeRepoRelative(importPath);
      if (!suffix) return [];
      const ext = path.posix.extname(suffix);
      return first(findBySuffix(index, stripExt(suffix), fromFile, ext ? [ext] : undefined));
    }

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// File access
// ---------------------------------------------------------------------------

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/**
 * Resolve a caller-supplied path inside the repo. Returns null for anything that
 * escapes the repo root, including via `..`, absolute paths, or symlinks.
 */
export function resolveRepoPath(repoDir: string, filePath: string): string | null {
  const root = path.resolve(repoDir);
  const target = path.resolve(root, filePath);
  if (!isWithin(root, target)) return null;

  try {
    const realRoot = fs.realpathSync(root);
    const realTarget = fs.realpathSync(target);
    return isWithin(realRoot, realTarget) ? realTarget : null;
  } catch {
    return null;
  }
}

export function getFileContent(repoDir: string, filePath: string, maxLines: number = 200): string {
  const fullPath = resolveRepoPath(repoDir, filePath);
  if (!fullPath) return "";

  try {
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    if (lines.length <= maxLines) return content;
    return lines.slice(0, maxLines).join("\n") + `\n// ... (${lines.length - maxLines} more lines truncated)`;
  } catch {
    return "";
  }
}
