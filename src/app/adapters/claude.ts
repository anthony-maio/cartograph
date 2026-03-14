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
const AGENT_NAMES = [
  "repo-scout",
  "dependency-tracer",
  "context-picker",
  "api-surface-writer",
  "wiki-writer",
] as const;
const SKILL_NAMES = [
  "use-cartograph",
  "repo-surveyor",
] as const;

export const claudeAdapter: AdapterManifest = {
  id: "claude",
  label: "Claude Code",
  description: "Install Cartograph skills and subagents into the user-scoped Claude directory.",

  resolveTargetRoot(env = process.env): string {
    const override = env.CARTOGRAPH_CLAUDE_HOME?.trim();
    if (override) {
      return path.resolve(override);
    }

    return path.join(resolveUserHome(env), ".claude");
  },

  getAssets(ctx: AdapterContext = {}) {
    const packageRoot = ctx.packageRoot ?? PACKAGE_ROOT;
    const targetRoot = this.resolveTargetRoot(ctx.env);

    return [
      ...SKILL_NAMES.map((name) => ({
        label: `skill:${name}`,
        kind: "directory" as const,
        sourcePath: path.join(packageRoot, "assets", "claude", "skills", name),
        targetPath: path.join(targetRoot, "skills", name),
      })),
      ...AGENT_NAMES.map((name) => ({
        label: `agent:${name}`,
        kind: "file" as const,
        sourcePath: path.join(packageRoot, "assets", "claude", "agents", `${name}.md`),
        targetPath: path.join(targetRoot, "agents", `${name}.md`),
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
