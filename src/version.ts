// Single source of truth for the runtime version. esbuild inlines the JSON at build time.
import packageJson from "../package.json";

export const VERSION: string = packageJson.version;
