import { getAdapter, getSupportedAdapterIds, isAdapterId, listAdapters } from "../adapters";

export function handleDoctorCommand(target: string | undefined, opts: { json?: boolean }) {
  const adapters = target
    ? [resolveTargetAdapter(target)]
    : listAdapters();
  const report = {
    adapters: adapters.map((adapter) => adapter.doctor()),
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2));
    return;
  }

  for (const adapter of report.adapters) {
    console.log(`${adapter.id}: ${adapter.installed ? "installed" : "missing"} (${adapter.targetRoot})`);
    for (const asset of adapter.assets) {
      console.log(`- ${asset.label}: ${asset.exists ? "ok" : "missing"} -> ${asset.path}`);
    }
  }
}

function resolveTargetAdapter(target: string) {
  if (!isAdapterId(target)) {
    throw new Error(`Unknown adapter '${target}'. Supported targets: ${getSupportedAdapterIds().join(", ")}`);
  }

  return getAdapter(target);
}
