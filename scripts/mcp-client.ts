import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** Spawn the Guardian MCP server over stdio and return a connected client. */
export async function connectAgent(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "server/guardian-mcp.ts"],
  });
  const client = new Client({ name: "demo-agent", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

export async function call(client: Client, tool: string, args: Record<string, unknown>): Promise<string> {
  const res = await client.callTool({ name: tool, arguments: args });
  const content = (res.content as { type: string; text?: string }[]) ?? [];
  return content.map((c) => c.text ?? "").join("\n");
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function banner(s: string) {
  console.log(`\n══════ ${s} ══════`);
}
