import {
  dailySpendCents,
  hasPriorPayment,
  listPolicies,
  recentTxCount,
} from "../db";
import type { PolicyRule, ToolCall } from "../types";

/** Deterministic evaluation of every enabled policy against one tool call. */
export function matchRules(call: ToolCall): PolicyRule[] {
  const hits: PolicyRule[] = [];
  const policies = listPolicies().filter(
    (p) => p.enabled && (p.agentId === "*" || p.agentId === call.agentId),
  );
  const amountValue = call.amount ? parseFloat(call.amount.value) : null;

  for (const p of policies) {
    switch (p.type) {
      case "amount_limit": {
        if (amountValue !== null && amountValue > Number(p.params.value)) hits.push(p);
        break;
      }
      case "daily_total_limit": {
        if (amountValue !== null) {
          const spentCents = dailySpendCents(call.agentId);
          const projectedCents = spentCents + Math.round(amountValue * 100);
          if (projectedCents > Number(p.params.value) * 100) hits.push(p);
        }
        break;
      }
      case "velocity_limit": {
        if (
          amountValue !== null ||
          call.tool === "create_payment" ||
          call.tool === "send_invoice"
        ) {
          const n = recentTxCount(call.agentId, 1);
          if (n >= Number(p.params.perMinute ?? 3)) hits.push(p);
        }
        break;
      }
      case "recipient_allowlist": {
        const allowed = (p.params.recipients as string[] ?? []).map((r) => r.toLowerCase());
        if (call.recipient && !allowed.includes(call.recipient.toLowerCase())) hits.push(p);
        break;
      }
      case "recipient_blocklist": {
        const blocked = (p.params.recipients as string[] ?? []).map((r) => r.toLowerCase());
        if (call.recipient && blocked.includes(call.recipient.toLowerCase())) hits.push(p);
        break;
      }
      case "new_recipient_approval": {
        if (
          call.recipient &&
          amountValue !== null &&
          !hasPriorPayment(call.agentId, call.recipient)
        )
          hits.push(p);
        break;
      }
      case "tool_whitelist": {
        const allowed = (p.params.tools as string[] ?? []) as string[];
        if (!allowed.includes(call.tool)) hits.push(p);
        break;
      }
      case "approval_required_tools": {
        const gated = (p.params.tools as string[] ?? []) as string[];
        if (gated.includes(call.tool)) hits.push(p);
        break;
      }
    }
  }
  return hits;
}
