import { getApproval, listAgents, recordAudit, saveApproval } from "../db";
import type {
  ApprovalRequest,
  Decision,
  GuardianAgent,
  ToolCall,
} from "../types";
import { matchRules } from "./rules";
import { assessRisk } from "./risk";
import { llmAvailable, chatJson } from "./llm";
import crypto from "node:crypto";

const RISK_APPROVAL_THRESHOLD = 65;

/**
 * Core gate: every agent tool call is evaluated here BEFORE any PayPal
 * interaction. Deterministic rules decide; the LLM only adds context.
 */
export async function evaluate(call: ToolCall): Promise<Decision> {
  const agent = listAgents().find((a) => a.id === call.agentId);
  const matched = matchRules(call);
  const risk = await assessRisk(call, agent, matched);

  const blocking = matched.filter((m) => m.action === "block");
  const approval = matched.filter((m) => m.action === "require_approval");

  let outcome: Decision["outcome"];
  if (blocking.length > 0) outcome = "block";
  else if (approval.length > 0 || risk.score >= RISK_APPROVAL_THRESHOLD) outcome = "require_approval";
  else outcome = "allow";

  const explanation = await explain(call, agent, outcome, matched, risk.factors, risk.score);
  const agentMessage = buildAgentMessage(call, outcome, matched);

  return {
    outcome,
    matchedRules: matched,
    riskScore: risk.score,
    riskFactors: risk.factors,
    explanation,
    agentMessage,
  };
}

function buildAgentMessage(
  call: ToolCall,
  outcome: Decision["outcome"],
  matched: Decision["matchedRules"],
): string {
  if (outcome === "allow") return "Action approved by Guardian policy check. Proceeding.";
  const reasons = matched.map((m) => m.reason.replace(/[.\s]+$/, ""));
  if (outcome === "block")
    return `BLOCKED by Agent Guardian: ${reasons.join(" | ")}. Do not retry this action. If the user insists, tell them a human must update the policy in the Guardian dashboard.`;
  return `HELD for human approval by Agent Guardian: ${reasons.join(" | ")}. An approval request was created; poll guardian_check_approval with the approval id. Do not resend the payment.`;
}

async function explain(
  call: ToolCall,
  agent: GuardianAgent | undefined,
  outcome: Decision["outcome"],
  matched: Decision["matchedRules"],
  factors: string[],
  score: number,
): Promise<string> {
  const fallback = templateExplanation(call, agent, outcome, matched, factors, score);
  if (!llmAvailable()) return fallback;
  return chatJson<{ explanation?: string }>(
    "You write one crisp sentence explaining a payment-guardrail decision to a human reviewer. Return JSON {\"explanation\": \"...\"}.",
    JSON.stringify({ outcome, fallback }),
    () => ({ explanation: fallback }),
  ).then((o) => (typeof o.explanation === "string" && o.explanation ? o.explanation : fallback));
}

export function templateExplanation(
  call: ToolCall,
  agent: GuardianAgent | undefined,
  outcome: Decision["outcome"],
  matched: Decision["matchedRules"],
  factors: string[],
  score: number,
): string {
  const who = agent?.name ?? call.agentId;
  const what = describeAction(call);
  const why =
    matched.length > 0
      ? `Rule(s) matched: ${matched.map((m) => `"${m.reason}"`).join("; ")}.`
      : factors.length > 0
        ? `Risk signals: ${factors.join("; ")}.`
        : "No policy rules matched.";
  const verb =
    outcome === "block" ? "was blocked" : outcome === "require_approval" ? "is held for your approval" : "was allowed automatically";
  return `${who} asked to ${what}. It ${verb} (risk ${score}/100). ${why}`;
}

function describeAction(call: ToolCall): string {
  const amount = call.amount ? `${call.amount.currency_code} ${call.amount.value}` : "n/a";
  switch (call.tool) {
    case "create_payment":
      return `pay ${amount} to ${call.recipient ?? "an unknown recipient"}`;
    case "capture_payment":
      return `capture ${amount} for order ${String(call.args.order_id ?? "?")}`;
    case "send_invoice":
      return `invoice ${call.recipient ?? "?"} for ${amount}`;
    case "open_dispute":
      return `open a dispute about ${String(call.args.item_name ?? "a transaction")}`;
    case "search_transactions":
      return `read the transaction history`;
    default:
      return call.tool;
  }
}

// ---------- approvals ----------

export async function createApprovalRequest(
  call: ToolCall,
  decision: Decision,
): Promise<ApprovalRequest> {
  const approval: ApprovalRequest = {
    id: `ap_${crypto.randomUUID().slice(0, 8)}`,
    agentId: call.agentId,
    toolCall: call,
    reason: decision.explanation,
    riskScore: decision.riskScore,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  saveApproval(approval);
  recordAudit({
    at: approval.createdAt,
    agentId: call.agentId,
    tool: call.tool,
    argsSummary: summarize(call),
    outcome: "require_approval",
    matchedRuleIds: decision.matchedRules.map((m) => m.id),
    riskScore: decision.riskScore,
    explanation: decision.explanation,
    approvalId: approval.id,
  });
  return approval;
}

export function decideApproval(
  id: string,
  approve: boolean,
  decidedBy = "dashboard-user",
): ApprovalRequest | undefined {
  const a = getApproval(id);
  if (!a || a.status !== "pending") return a;
  const decidedAt = new Date().toISOString();
  const updated: ApprovalRequest = {
    ...a,
    status: approve ? "approved" : "denied",
    decidedAt,
    decidedBy,
  };
  saveApproval(updated);
  recordAudit({
    at: decidedAt,
    agentId: a.agentId,
    tool: a.toolCall.tool,
    argsSummary: summarize(a.toolCall),
    outcome: "approval_decided",
    matchedRuleIds: [],
    riskScore: a.riskScore,
    explanation: `Human ${approve ? "approved" : "denied"} this held action.`,
    approvalId: a.id,
  });
  return updated;
}

export function summarize(call: ToolCall): string {
  const parts = [];
  if (call.amount) parts.push(`amount=${call.amount.value}`);
  if (call.recipient) parts.push(`to=${call.recipient}`);
  for (const k of ["order_id", "item_name", "note"]) {
    if (call.args[k]) parts.push(`${k}=${String(call.args[k]).slice(0, 40)}`);
  }
  return parts.join(" ") || JSON.stringify(call.args).slice(0, 80);
}

export { RISK_APPROVAL_THRESHOLD };
