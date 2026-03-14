import * as path from "node:path";
import {
  copyAdapterAsset,
  getAdapterStatusAssets,
  getPackageRoot,
  removeAdapterAsset,
  resolveUserHome,
  type AdapterContext,
  type AdapterInstallResult,
  type AdapterManifest,
  type AdapterStatus,
} from "./types";

const PACKAGE_ROOT = getPackageRoot();
const SKILL_NAMES = [
  "use-cartograph",
  "repo-surveyor",
] as const;

export const openclawAdapter: AdapterManifest = {
  id: "openclaw",
  label: "OpenClaw",
  description: "Install Cartograph shared skills into the user-scoped OpenClaw directory.",

  resolveTargetRoot(env = process.env): string {
    const override = env.CARTOGRAPH_OPENCLAW_HOME?.trim();
    if (override) {
      return path.resolve(override);
    }

    return path.join(resolveUserHome(env), ".openclaw");
  },

  getAssets(ctx: AdapterContext = {}) {
    const packageRoot = ctx.packageRoot ?? PACKAGE_ROOT;
    const targetRoot = this.resolveTargetRoot(ctx.env);

    return [
      ...SKILL_NAMES.map((name) => ({
        label: `skill:${name}`,
        kind: "directory" as const,
        sourcePath: path.join(packageRoot, "assets", "openclaw", "skills", name),
        targetPath: path.join(targetRoot, "skills", name),
      })),
    ];
  },

  install(ctx: AdapterContext = {}): AdapterInstallResult {
    const assets = this.getAssets(ctx);
    for (const asset of assets) {
      copyAdapterAsset(asset);
    }

    return {
      id: this.id,
      targetRoot: this.resolveTargetRoot(ctx.env),
      installedPaths: assets.map((asset) => asset.targetPath),
    };
  },

  uninstall(ctx: AdapterContext = {}): AdapterInstallResult {
    const assets = this.getAssets(ctx);
    for (const asset of assets) {
      removeAdapterAsset(asset);
    }

    return {
      id: this.id,
      targetRoot: this.resolveTargetRoot(ctx.env),
      installedPaths: assets.map((asset) => asset.targetPath),
    };
  },

  doctor(ctx: AdapterContext = {}): AdapterStatus {
    const assets = this.getAssets(ctx);
    const statuses = getAdapterStatusAssets(assets);
    return {
      id: this.id,
      label: this.label,
      targetRoot: this.resolveTargetRoot(ctx.env),
      installed: statuses.every((asset) => asset.exists),
      assets: statuses,
    };
  },
};
