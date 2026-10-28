import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getPackageRoot,
  resolveUserHome,
  type AdapterContext,
  type AdapterManifest,
} from "./types";

const PACKAGE_ROOT = getPackageRoot();
const OWNER = "@anthony-maio/cartograph";
const MARKER = ".cartograph-install.json";
const MANAGED_FILES = ["plugin.yaml", "__init__.py", "runtime.json"] as const;

interface InstallMarker {
  schema_version: 1;
  owner: typeof OWNER;
  files: Record<typeof MANAGED_FILES[number], string>;
}

function fileHash(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// Refuse junctions as well as symlinks before touching a host profile. Checking
// every existing ancestor also covers a redirected plugins or cache directory.
function assertSafePath(target: string): void {
  let current = path.resolve(target);
  while (true) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error(`Refusing a symlink or junction in the Hermes install path: ${current}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function isRegularFile(target: string): boolean {
  try {
    return fs.lstatSync(target).isFile();
  } catch {
    return false;
  }
}

function assertCacheDirectory(target: string): void {
  assertSafePath(target);
  if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) {
    throw new Error(`Cartograph's Hermes cache path must be a directory: ${target}`);
  }
}

function writeManagedFile(target: string, content: string | Buffer): void {
  const temporary = path.join(path.dirname(target), `.cartograph-${crypto.randomBytes(8).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(temporary, content, { flag: "wx" });
    assertSafePath(target);
    // Replacement leaves any hard-linked copy of the old file untouched.
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function readMarker(pluginRoot: string): InstallMarker {
  const markerPath = path.join(pluginRoot, MARKER);
  assertSafePath(markerPath);
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, "utf8")) as InstallMarker;
    if (marker.schema_version !== 1 || marker.owner !== OWNER || !marker.files
      || Object.keys(marker.files).length !== MANAGED_FILES.length
      || !MANAGED_FILES.every((name) => /^[a-f0-9]{64}$/.test(marker.files[name] ?? ""))) {
      throw new Error("Invalid ownership marker");
    }
    return marker;
  } catch {
    throw new Error(`Refusing to modify an unowned Hermes plugin directory: ${pluginRoot}`);
  }
}

function assertManagedFilesUnchanged(pluginRoot: string, marker: InstallMarker): void {
  for (const name of MANAGED_FILES) {
    const target = path.join(pluginRoot, name);
    assertSafePath(target);
    if (!fs.existsSync(target)) continue; // A reinstall can repair a missing file.
    if (!isRegularFile(target) || fileHash(fs.readFileSync(target)) !== marker.files[name]) {
      throw new Error(`Preserving a modified Hermes plugin file: ${target}. Move or restore it before reinstalling or uninstalling.`);
    }
  }
}

function runtimeIssues(runtimePath: string, targetRoot: string): string[] {
  try {
    const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
    const issues: string[] = [];
    for (const name of ["node", "cli"] as const) {
      if (typeof runtime[name] !== "string" || !path.isAbsolute(runtime[name]) || !isRegularFile(runtime[name])) {
        issues.push(`Hermes runtime ${name} must point to an existing absolute file path.`);
      }
    }
    if (issues.length === 0) {
      try {
        fs.accessSync(runtime.node, fs.constants.X_OK);
      } catch {
        issues.push("The Node executable recorded in the Hermes runtime is not executable.");
      }
    }
    const expectedCache = path.join(targetRoot, "cache", "cartograph");
    if (runtime.cache_dir !== expectedCache) {
      issues.push("Hermes runtime cache_dir must stay in this profile's cache/cartograph directory.");
    }
    assertCacheDirectory(expectedCache);
    return issues;
  } catch (error) {
    return [`Hermes runtime configuration is unavailable or invalid: ${(error as Error).message}`];
  }
}

export const hermesAdapter: AdapterManifest = {
  id: "hermes",
  label: "Hermes",
  description: "Install the Cartograph tool plugin into a Hermes profile; enabling it remains explicit.",

  resolveTargetRoot(env = process.env): string {
    const override = env.CARTOGRAPH_HERMES_HOME?.trim() || env.HERMES_HOME?.trim();
    return override ? path.resolve(override) : path.join(resolveUserHome(env), ".hermes");
  },

  getAssets(ctx: AdapterContext = {}) {
    const packageRoot = ctx.packageRoot ?? PACKAGE_ROOT;
    const pluginRoot = path.join(this.resolveTargetRoot(ctx.env), "plugins", "cartograph");
    return ["plugin.yaml", "__init__.py"].map((name) => ({
      label: `plugin:cartograph/${name}`,
      kind: "file" as const,
      sourcePath: path.join(packageRoot, "assets", "hermes", name),
      targetPath: path.join(pluginRoot, name),
    }));
  },

  install(ctx: AdapterContext = {}) {
    const targetRoot = this.resolveTargetRoot(ctx.env);
    const pluginRoot = path.join(targetRoot, "plugins", "cartograph");
    const packageRoot = ctx.packageRoot ?? PACKAGE_ROOT;
    const runtime = {
      node: process.execPath,
      cli: path.resolve(packageRoot, "dist", "cli.cjs"),
      cache_dir: path.join(targetRoot, "cache", "cartograph"),
    };
    assertSafePath(pluginRoot);
    assertCacheDirectory(runtime.cache_dir);
    if (fs.existsSync(pluginRoot)) {
      assertManagedFilesUnchanged(pluginRoot, readMarker(pluginRoot));
    }
    if (!isRegularFile(runtime.cli)) {
      throw new Error(`Missing Cartograph runtime: ${runtime.cli}. Build or reinstall Cartograph before installing its Hermes plugin.`);
    }

    // Read all inputs before creating or changing anything in the host profile.
    const contents = new Map<string, Buffer | string>();
    for (const asset of this.getAssets(ctx)) {
      if (!isRegularFile(asset.sourcePath)) throw new Error(`Missing packaged asset: ${asset.sourcePath}`);
      contents.set(path.basename(asset.targetPath), fs.readFileSync(asset.sourcePath));
    }
    contents.set("runtime.json", `${JSON.stringify(runtime, null, 2)}\n`);
    const marker: InstallMarker = {
      schema_version: 1,
      owner: OWNER,
      files: Object.fromEntries(MANAGED_FILES.map((name) => [name, fileHash(contents.get(name)!)])) as InstallMarker["files"],
    };
    contents.set(MARKER, `${JSON.stringify(marker, null, 2)}\n`);

    fs.mkdirSync(pluginRoot, { recursive: true });
    for (const [name, content] of contents) {
      const target = path.join(pluginRoot, name);
      assertSafePath(target);
      writeManagedFile(target, content);
    }
    return { id: this.id, targetRoot, installedPaths: Array.from(contents.keys(), (name) => path.join(pluginRoot, name)) };
  },

  uninstall(ctx: AdapterContext = {}) {
    const targetRoot = this.resolveTargetRoot(ctx.env);
    const pluginRoot = path.join(targetRoot, "plugins", "cartograph");
    assertSafePath(pluginRoot);
    if (!fs.existsSync(pluginRoot)) return { id: this.id, targetRoot, installedPaths: [] };
    assertManagedFilesUnchanged(pluginRoot, readMarker(pluginRoot));
    const installedPaths = MANAGED_FILES.map((name) => path.join(pluginRoot, name));
    for (const target of installedPaths) {
      assertSafePath(target);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    // Keep user additions and generated caches. Retain ownership when additions
    // remain so a later reinstall can safely reuse the directory.
    if (fs.readdirSync(pluginRoot).every((name) => name === MARKER)) {
      const markerPath = path.join(pluginRoot, MARKER);
      fs.unlinkSync(markerPath);
      installedPaths.push(markerPath);
      fs.rmdirSync(pluginRoot);
    }
    return { id: this.id, targetRoot, installedPaths };
  },

  doctor(ctx: AdapterContext = {}) {
    const targetRoot = this.resolveTargetRoot(ctx.env);
    const pluginRoot = path.join(targetRoot, "plugins", "cartograph");
    const assets = [...MANAGED_FILES, MARKER].map((name) => ({
      label: `plugin:cartograph/${name}`,
      path: path.join(pluginRoot, name),
      exists: isRegularFile(path.join(pluginRoot, name)),
    }));
    const issues: string[] = [];
    try {
      assertSafePath(pluginRoot);
      if (fs.existsSync(pluginRoot)) {
        assertManagedFilesUnchanged(pluginRoot, readMarker(pluginRoot));
        issues.push(...runtimeIssues(path.join(pluginRoot, "runtime.json"), targetRoot));
      }
    } catch (error) {
      issues.push((error as Error).message);
    }
    return {
      id: this.id,
      label: this.label,
      targetRoot,
      installed: assets.every((asset) => asset.exists) && issues.length === 0,
      assets,
      issues,
    };
  },
};
