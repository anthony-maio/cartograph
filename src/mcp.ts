import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCartographMcpServer } from "./app/mcp-server";

async function main() {
  const server = createCartographMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Cartograph MCP server failed to start:", err);
  process.exit(1);
});
