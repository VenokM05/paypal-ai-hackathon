/**
 * Shared decision dispatch used by BOTH the MCP server (real agents) and the
 * in-app attack scenarios (dashboard buttons), so the demo path and the agent
 * path run the exact same code.
 */
import { getApproval, listAgents, recordAudit, saveApproval } from "../db";
import { getGateway } from "../paypal/gateway";
import type { ToolCall } from "../types";
import { createApprovalRequest, decideApproval, evaluate, summarize } from "./engine";

export async function guarded(call: ToolCall): Promise<string> {
  const decision = await evaluate(call);

  if (decision.outcome === "block") {
    recordAudit({
      at: new Date().toISOString(),
      agentId: call.agentId,
      tool: call.tool,
      argsSummary: summarize(call),
      outcome: "block",
      matchedRuleIds: decision.matchedRules.map((m) => m.id),
      riskScore: decision.riskScore,
      explanation: decision.explanation,
    });
    return `🛑 ${decision.agentMessage}\n\nRisk: ${decision.riskScore}/100. This was logged to the Guardian audit trail.`;
  }

  if (decision.outcome === "require_approval") {
    const approval = await createApprovalRequest(call, decision);
    return (
      `⏸ ${decision.agentMessage}\n\napproval_id: ${approval.id}\nRisk: ${decision.riskScore}/100.\n` +
      `Call guardian_check_approval with this id (wait ~15s between polls; it may take a minute for the human).`
    );
  }

  return execute(call);
}

/** Actually run the PayPal call and record it as executed. */
export async function execute(call: ToolCall): Promise<string> {
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

/** guardian_check_approval: poll a held action; if approved, execute it once. */
export async function checkApproval(approvalId: string): Promise<string> {
  const appt = getApproval(approvalId);
  if (!appt) return `No approval with id ${approvalId}.`;
  if (appt.status === "pending") return `⏳ Still waiting for human approval (${appt.reason})`;
  if (appt.status === "denied") return `❌ Human denied this action. Do not retry. Reason logged in audit trail.`;
  if (appt.status === "expired") return `❌ Approval expired. Ask the human to re-approve.`;
  if (appt.executed) return `Already executed after approval.`;
  saveApproval({ ...appt, executed: true });
  return execute(appt.toolCall);
}

export { decideApproval, listAgents };
