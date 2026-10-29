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
import {
  createApprovalRequest,
  evaluate,
  summarize,
} from "../src/lib/guardian/engine";
import { getApproval, listAgents, recordAudit, saveApproval } from "../src/lib/db";
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

async function guarded(
  tool: ToolCall["tool"],
  agentId: string,
  args: Record<string, unknown>,
  recipient: string | undefined,
  amount: { currency_code: string; value: string } | undefined,
) {
  const call: ToolCall = { tool, args, agentId, recipient, amount };
  const decision = await evaluate(call);

  if (decision.outcome === "block") {
    recordAudit({
      at: new Date().toISOString(),
      agentId,
      tool,
      argsSummary: summarize(call),
      outcome: "block",
      matchedRuleIds: decision.matchedRules.map((m) => m.id),
      riskScore: decision.riskScore,
      explanation: decision.explanation,
    });
    return text(`🛑 ${decision.agentMessage}\n\nRisk: ${decision.riskScore}/100. This was logged to the Guardian audit trail.`);
  }

  if (decision.outcome === "require_approval") {
    const approval = await createApprovalRequest(call, decision);
    return text(
      `⏸ ${decision.agentMessage}\n\napproval_id: ${approval.id}\nRisk: ${decision.riskScore}/100.\nCall guardian_check_approval with this id (wait ~15s between polls; it may take a minute for the human).`,
    );
  }

  const result = await execute(call);
  return text(result);
}

/** Actually run the PayPal call and record it as executed. */
async function execute(call: ToolCall): Promise<string> {
  const gw = getGateway();
  let r: { id: string; status: string; detail: string };
  switch (call.tool) {
    case "create_payment": {
      r = await gw.createOrder({
        recipient: call.recipient ?? "unknown",
        amount: call.amount!,
        note: String(call.args.note ?? ""),
      });
      break;
    }
    case "capture_payment":
      r = await gw.captureOrder({ orderId: String(call.args.order_id) });
      break;
    case "send_invoice":
      r = await gw.sendInvoice({
        recipient: call.recipient ?? "unknown",
        amount: call.amount!,
        memo: String(call.args.memo ?? ""),
      });
      break;
    case "open_dispute":
      r = await gw.openDispute({
        transactionId: call.args.transaction_id ? String(call.args.transaction_id) : undefined,
        itemName: String(call.args.item_name ?? ""),
        reason: String(call.args.reason ?? ""),
      });
      break;
    case "search_transactions": {
      const s = await gw.searchTransactions({
        startDate: call.args.start_date ? String(call.args.start_date) : undefined,
        endDate: call.args.end_date ? String(call.args.end_date) : undefined,
      });
      recordAudit({
        at: new Date().toISOString(),
        agentId: call.agentId,
        tool: call.tool,
        argsSummary: summarize(call),
        outcome: "allow",
        matchedRuleIds: [],
        riskScore: 0,
        explanation: `Read-only search allowed: ${s.detail}`,
      });
      return `✅ ${s.detail}\n${JSON.stringify(s.items, null, 2).slice(0, 2000)}`;
    }
    default:
      return "Unknown tool.";
  }
  recordAudit({
    at: new Date().toISOString(),
    agentId: call.agentId,
    tool: call.tool,
    argsSummary: summarize(call),
    outcome: "executed",
    matchedRuleIds: [],
    riskScore: 0,
    explanation: `Executed against PayPal (${gw.mode} mode): ${r.detail}`,
    paypalRef: r.id,
  });
  return `✅ Executed (PayPal ${gw.mode}): ${r.detail} [status ${r.status}]`;
}

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
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
    guarded("create_payment", a.agent_id, { note: a.note }, a.recipient_email, {
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
    guarded("capture_payment", a.agent_id, { order_id: a.order_id }, undefined, a.amount
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
    guarded("send_invoice", a.agent_id, { memo: a.memo }, a.recipient_email, {
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
    guarded("open_dispute", a.agent_id, { item_name: a.item_name, reason: a.reason, transaction_id: a.transaction_id }, undefined, undefined),
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
    guarded("search_transactions", a.agent_id, { start_date: a.start_date, end_date: a.end_date }, undefined, undefined),
);

server.registerTool(
  "guardian_check_approval",
  {
    title: "Poll a held action",
    description:
      "Check a held approval_id. If a human approved it, Guardian executes the original PayPal action for you and returns the result.",
    inputSchema: { approval_id: z.string() },
  },
  async (a) => {
    const appt = getApproval(a.approval_id);
    if (!appt) return text(`No approval with id ${a.approval_id}.`);
    if (appt.status === "pending") return text(`⏳ Still waiting for human approval (${appt.reason})`);
    if (appt.status === "denied") return text(`❌ Human denied this action. Do not retry. Reason logged in audit trail.`);
    if (appt.status === "expired") return text(`❌ Approval expired. Ask the human to re-approve.`);
    // approved → execute once
    if (appt.toolCall) {
      const executedFlag = (appt as unknown as { executed?: boolean }).executed;
      if (!executedFlag) {
        saveApproval({ ...appt, status: "approved" });
        (appt as unknown as { executed?: boolean }).executed = true;
        saveApproval(appt);
        return text(await execute(appt.toolCall));
      }
      return text(`Already executed after approval.`);
    }
    return text("Approved but nothing to execute.");
  },
);

server.registerTool(
  "guardian_list_agents",
  {
    title: "List known agents",
    description: "Ids and trust levels of agents Guardian knows about (for agent_id values).",
    inputSchema: {},
  },
  async () => {
    const agents = listAgents();
    return text(agents.map((a) => `${a.id} — ${a.name} (trust: ${a.trustLevel})`).join("\n"));
  },
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
