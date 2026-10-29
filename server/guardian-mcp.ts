/**
 * Agent Guardian MCP server (stdio).
 *
 * This is the ONLY payment surface an agent is allowed to talk to. Instead of
 * pointing an agent at PayPal's MCP server directly, you point it at Guardian,
 * which proxies the same PayPal actions through the policy engine, risk scorer,
 * human-approval queue and audit log first.
 *
 * Run:  npx tsx server/guardian-mcp.ts
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { guarded, checkApproval } from "../src/lib/guardian/dispatch";
import { listAgents } from "../src/lib/db";
import { getGateway } from "../src/lib/paypal/gateway";
import type { ToolCall } from "../src/lib/types";

const server = new McpServer({
  name: "agent-guardian",
  version: "0.1.0",
});

const amountSchema = z.object({
  value: z.string().describe("Decimal string, e.g. \"49.99\""),
  currency: z.string().default("USD"),
});

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

async function run(tool: ToolCall["tool"], agentId: string, args: Record<string, unknown>, recipient?: string, amount?: { currency_code: string; value: string }) {
  return text(await guarded({ tool, args, agentId, recipient, amount }));
}

// ---------------- tools ----------------

server.registerTool(
  "agent_pay",
  {
    title: "Pay via PayPal (guarded)",
    description:
      "Create and send a PayPal payment to a recipient. ALWAYS goes through Guardian policy checks first. Never call PayPal directly.",
    inputSchema: {
      agent_id: z.string().describe("Which agent you are, e.g. shopping-assistant"),
      recipient_email: z.string(),
      amount: amountSchema,
      note: z.string().optional(),
    },
  },
  async (a) =>
    run("create_payment", a.agent_id, { note: a.note }, a.recipient_email, {
      currency_code: a.amount.currency,
      value: a.amount.value,
    }),
);

server.registerTool(
  "capture_payment",
  {
    title: "Capture a PayPal order (guarded)",
    description: "Capture a previously created PayPal order id through Guardian.",
    inputSchema: {
      agent_id: z.string(),
      order_id: z.string(),
      amount: amountSchema.optional(),
    },
  },
  async (a) =>
    run("capture_payment", a.agent_id, { order_id: a.order_id }, undefined, a.amount
      ? { currency_code: a.amount.currency, value: a.amount.value }
      : undefined),
);

server.registerTool(
  "send_invoice",
  {
    title: "Send a PayPal invoice (guarded)",
    description: "Create a PayPal invoice for a customer through Guardian.",
    inputSchema: {
      agent_id: z.string(),
      recipient_email: z.string(),
      amount: amountSchema,
      memo: z.string().optional(),
    },
  },
  async (a) =>
    run("send_invoice", a.agent_id, { memo: a.memo }, a.recipient_email, {
      currency_code: a.amount.currency,
      value: a.amount.value,
    }),
);

server.registerTool(
  "open_dispute",
  {
    title: "Open a PayPal dispute (guarded)",
    description: "Raise a dispute/chargeback request through Guardian.",
    inputSchema: {
      agent_id: z.string(),
      item_name: z.string(),
      reason: z.string(),
      transaction_id: z.string().optional(),
    },
  },
  async (a) =>
    run("open_dispute", a.agent_id, { item_name: a.item_name, reason: a.reason, transaction_id: a.transaction_id }, undefined, undefined),
);

server.registerTool(
  "search_transactions",
  {
    title: "Search PayPal transactions (guarded, read-only)",
    description: "Look up PayPal transaction history via the Reporting API, through Guardian.",
    inputSchema: {
      agent_id: z.string(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
    },
  },
  async (a) =>
    run("search_transactions", a.agent_id, { start_date: a.start_date, end_date: a.end_date }, undefined, undefined),
);

server.registerTool(
  "guardian_check_approval",
  {
    title: "Poll a held action",
    description:
      "Check a held approval_id. If a human approved it, Guardian executes the original PayPal action for you and returns the result.",
    inputSchema: { approval_id: z.string() },
  },
  async (a) => text(await checkApproval(a.approval_id)),
);

server.registerTool(
  "guardian_list_agents",
  {
    title: "List known agents",
    description: "Ids and trust levels of agents Guardian knows about (for agent_id values).",
    inputSchema: {},
  },
  async () =>
    text(listAgents().map((a) => `${a.id} — ${a.name} (trust: ${a.trustLevel})`).join("\n")),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Agent Guardian MCP server running (${getGateway().mode === "live" ? "LIVE sandbox" : "mock"} PayPal mode).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
