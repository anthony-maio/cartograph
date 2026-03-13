import { claudeAdapter } from "./claude";
import { mcpAdapter } from "./mcp";
import { openclawAdapter } from "./openclaw";
import type { AdapterId, AdapterManifest } from "./types";

const registry = new Map<AdapterId, AdapterManifest>([
  ["claude", claudeAdapter],
  ["openclaw", openclawAdapter],
  ["mcp", mcpAdapter],
]);

export function listAdapters(): AdapterManifest[] {
  return Array.from(registry.values());
}

export function getAdapter(id: AdapterId): AdapterManifest {
  const adapter = registry.get(id);
  if (!adapter) {
    throw new Error(`Unknown adapter '${id}'.`);
  }

  return adapter;
}

export function isAdapterId(value: string): value is AdapterId {
  return registry.has(value as AdapterId);
}

export function getSupportedAdapterIds(): AdapterId[] {
  return Array.from(registry.keys());
}
