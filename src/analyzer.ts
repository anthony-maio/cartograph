import simpleGit from "simple-git";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { FileNode, DependencyEdge } from "./schema";

// Language detection by extension
const LANG_MAP: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
  ".mjs": "javascript", ".cjs": "javascript", ".py": "python", ".go": "go",
  ".rs": "rust", ".java": "java", ".kt": "kotlin", ".rb": "ruby",
  ".php": "php", ".c": "c", ".cpp": "cpp", ".h": "c", ".hpp": "cpp",
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

// Import regex patterns by language group
const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ],
  javascript: [
    /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ],
  python: [
    /from\s+([\w.]+)\s+import/g,
    /^import\s+([\w.]+)/gm,
  ],
  go: [
    /import\s+"([^"]+)"/g,
    /import\s+\w+\s+"([^"]+)"/g,
  ],
  rust: [
    /use\s+([\w:]+)/g,
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

export async function cloneRepo(repoUrl: string, branch?: string): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), createCloneDirName(process.platform));
  fs.mkdirSync(tmpDir, { recursive: true });

  const git = simpleGit();
  const cloneOptions = buildCloneOptions(branch, process.platform);

  await git.clone(repoUrl, tmpDir, cloneOptions);
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

function walkDir(dir: string, basePath: string = ""): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          files.push(...walkDir(fullPath, relativePath));
        }
      } else if (entry.isFile()) {
        if (!SKIP_FILES.has(entry.name)) {
          files.push(relativePath);
        }
      }
    }
  } catch {
    // Skip unreadable directories
  }

  return files;
}

function extractImports(content: string, language: string): string[] {
  const langGroup = language === "tsx" ? "typescript" :
                    language === "jsx" ? "javascript" : language;
  const patterns = IMPORT_PATTERNS[langGroup];
  if (!patterns) return [];

  const imports: Set<string> = new Set();
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) imports.add(match[1].trim());
    }
  }
  return Array.from(imports);
}

function extractExports(content: string, language: string): string[] {
  const langGroup = language === "tsx" ? "typescript" :
                    language === "jsx" ? "javascript" : language;
  const patterns = EXPORT_PATTERNS[langGroup];
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
  const filePaths = walkDir(repoDir);
  const files: FileNode[] = [];
  const edges: DependencyEdge[] = [];

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

  // Build a map for resolving relative imports
  const filesByName = new Map<string, string>();
  for (const f of files) {
    const basename = path.basename(f.path, path.extname(f.path));
    filesByName.set(basename, f.path);
    filesByName.set(f.path, f.path);
    // Also map without extension
    const noExt = f.path.replace(/\.\w+$/, "");
    filesByName.set(noExt, f.path);
  }

  // Build dependency edges
  const fanInCount = new Map<string, number>(); // how many files import this file
  for (const file of files) {
    for (const imp of file.imports) {
      // Try to resolve the import to a file in the repo
      const resolved = resolveImport(imp, file.path, filesByName);
      if (resolved) {
        edges.push({ from: file.path, to: resolved });
        fanInCount.set(resolved, (fanInCount.get(resolved) || 0) + 1);
      }
    }
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

function resolveImport(importPath: string, fromFile: string, fileMap: Map<string, string>): string | null {
  // Skip external packages
  if (!importPath.startsWith(".") && !importPath.startsWith("/") && !importPath.startsWith("@/")) {
    // Could be a bare module. Check if any file matches by basename
    const basename = importPath.split("/").pop() || importPath;
    if (fileMap.has(basename)) return fileMap.get(basename)!;
    return null;
  }

  // Resolve relative import
  const fromDir = path.dirname(fromFile);
  let resolved = importPath.startsWith("@/")
    ? importPath.replace("@/", "")
    : path.normalize(path.join(fromDir, importPath));

  // Clean up path
  resolved = resolved.replace(/\\/g, "/");

  // Try exact match, then with common extensions
  if (fileMap.has(resolved)) return fileMap.get(resolved)!;

  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"]) {
    if (fileMap.has(resolved + ext)) return fileMap.get(resolved + ext)!;
  }

  // Try /index
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    if (fileMap.has(resolved + "/index" + ext)) return fileMap.get(resolved + "/index" + ext)!;
  }

  return null;
}

export function getFileContent(repoDir: string, filePath: string, maxLines: number = 200): string {
  try {
    const fullPath = path.join(repoDir, filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    if (lines.length <= maxLines) return content;
    return lines.slice(0, maxLines).join("\n") + `\n// ... (${lines.length - maxLines} more lines truncated)`;
  } catch {
    return "";
  }
}
