import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type AdapterId = "claude" | "openclaw" | "mcp";

export interface AdapterContext {
  env?: NodeJS.ProcessEnv;
  packageRoot?: string;
}

export interface AdapterAsset {
  label: string;
  kind: "file" | "directory";
  sourcePath: string;
  targetPath: string;
}

export interface AdapterInstallResult {
  id: AdapterId;
  targetRoot: string;
  installedPaths: string[];
}

export interface AdapterStatusAsset {
  label: string;
  path: string;
  exists: boolean;
}

export interface AdapterStatus {
  id: AdapterId;
  label: string;
  targetRoot: string;
  installed: boolean;
  assets: AdapterStatusAsset[];
}

export interface AdapterManifest {
  id: AdapterId;
  label: string;
  description: string;
  resolveTargetRoot(env?: NodeJS.ProcessEnv): string;
  getAssets(ctx?: AdapterContext): AdapterAsset[];
  install(ctx?: AdapterContext): AdapterInstallResult;
  uninstall(ctx?: AdapterContext): AdapterInstallResult;
  doctor(ctx?: AdapterContext): AdapterStatus;
}

export function resolveUserHome(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.USERPROFILE?.trim() || env.HOME?.trim();
  return override ? path.resolve(override) : os.homedir();
}

export function getPackageRoot(): string {
  const startDir = typeof __dirname !== "undefined"
    ? __dirname
    : process.cwd();

  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Unable to locate package root from ${startDir}`);
    }
    current = parent;
  }
}

export function copyAdapterAsset(asset: AdapterAsset): void {
  if (!fs.existsSync(asset.sourcePath)) {
    throw new Error(`Missing packaged asset: ${asset.sourcePath}`);
  }

  fs.mkdirSync(path.dirname(asset.targetPath), { recursive: true });
  if (asset.kind === "directory") {
    fs.cpSync(asset.sourcePath, asset.targetPath, { recursive: true, force: true });
    return;
  }

  fs.copyFileSync(asset.sourcePath, asset.targetPath);
}

export function removeAdapterAsset(asset: AdapterAsset): void {
  fs.rmSync(asset.targetPath, { recursive: true, force: true });
}

export function getAdapterStatusAssets(assets: AdapterAsset[]): AdapterStatusAsset[] {
  return assets.map((asset) => ({
    label: asset.label,
    path: asset.targetPath,
    exists: fs.existsSync(asset.targetPath),
  }));
}
