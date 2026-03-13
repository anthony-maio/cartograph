import chalk from "chalk";
import { getAdapter, getSupportedAdapterIds, isAdapterId } from "../adapters";

export function handleUninstallCommand(target?: string) {
  if (!target) {
    console.error(chalk.red(`Uninstall requires an explicit adapter target. Supported targets: ${getSupportedAdapterIds().join(", ")}`));
    process.exit(1);
  }

  if (!isAdapterId(target)) {
    console.error(chalk.red(`Unknown adapter '${target}'. Supported targets: ${getSupportedAdapterIds().join(", ")}`));
    process.exit(1);
  }

  const adapter = getAdapter(target);
  const result = adapter.uninstall();
  console.log(`Removed ${adapter.label} assets from ${result.targetRoot}`);
}
