import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CloneCache } from "./app/clone-cache";
import { createCartographMcpServer } from "./app/mcp-server";

async function main() {
  // Hosts usually stop stdio servers by killing the process, so clean up cached clones on the way out
  const cloneCache = new CloneCache();
  process.on("exit", () => cloneCache.clear());
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => process.exit(0));
  }

  const server = createCartographMcpServer({ cloneCache });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Cartograph MCP server failed to start:", err);
  process.exit(1);
});
