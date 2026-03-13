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

export const mcpAdapter: AdapterManifest = {
  id: "mcp",
  label: "MCP",
  description: "Install a Cartograph MCP server config snippet without modifying host configs automatically.",

  resolveTargetRoot(env = process.env): string {
    const override = env.CARTOGRAPH_MCP_HOME?.trim();
    if (override) {
      return path.resolve(override);
    }

    return path.join(resolveUserHome(env), ".cartograph", "mcp");
  },

  getAssets(ctx: AdapterContext = {}) {
    const packageRoot = ctx.packageRoot ?? PACKAGE_ROOT;
    const targetRoot = this.resolveTargetRoot(ctx.env);

    return [
      {
        label: "config:cartograph-mcp",
        kind: "file" as const,
        sourcePath: path.join(packageRoot, "assets", "mcp", "cartograph-mcp.json"),
        targetPath: path.join(targetRoot, "cartograph-mcp.json"),
      },
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
