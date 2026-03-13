import chalk from "chalk";
import { getAdapter, getSupportedAdapterIds, isAdapterId } from "../adapters";

export function handleInstallCommand(target?: string) {
  if (!target) {
    console.error(chalk.red(`Install requires an explicit adapter target. Supported targets: ${getSupportedAdapterIds().join(", ")}`));
    process.exit(1);
  }

  if (!isAdapterId(target)) {
    console.error(chalk.red(`Unknown adapter '${target}'. Supported targets: ${getSupportedAdapterIds().join(", ")}`));
    process.exit(1);
  }

  const adapter = getAdapter(target);
  const result = adapter.install();
  console.log(`Installed ${adapter.label} assets to ${result.targetRoot}`);
}
