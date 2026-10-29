/** Shared types for the Agent Guardian guardrail layer. */

export type MoneyAmount = {
  currency_code: string; // e.g. "USD"
  value: string; // decimal string, e.g. "49.99"
};

/** A PayPal-side tool invocation requested by an AI agent. */
export type ToolCall = {
  tool: GuardianToolName;
  args: Record<string, unknown>;
  agentId: string;
  /** id of the recipient / counterparty when the tool has one */
  recipient?: string;
  amount?: MoneyAmount;
};

export type GuardianToolName =
  | "create_payment"
  | "capture_payment"
  | "send_invoice"
  | "open_dispute"
  | "search_transactions";

export type RuleType =
  | "amount_limit" // single transaction cap
  | "daily_total_limit" // cumulative spend per agent per day
  | "velocity_limit" // max transactions per minute
  | "recipient_allowlist"
  | "recipient_blocklist"
  | "new_recipient_approval" // first payment to a recipient needs a human
  | "tool_whitelist" // agent may only call these tools
  | "approval_required_tools"; // calling these tools always needs a human

export type PolicyRule = {
  id: string;
  agentId: string | "*"; // "*" = applies to all agents
  type: RuleType;
  params: Record<string, unknown>;
  /** what happens when this rule matches */
  action: "block" | "require_approval";
  reason: string; // plain-English reason shown to agent + human
  source: "natural_language" | "structured" | "default";
  enabled: boolean;
  createdAt: string;
  /** original natural-language text, if compiled from prose */
  nlText?: string;
};

export type DecisionOutcome = "allow" | "block" | "require_approval";

export type Decision = {
  outcome: DecisionOutcome;
  matchedRules: PolicyRule[];
  riskScore: number; // 0-100
  riskFactors: string[];
  explanation: string; // human-facing
  agentMessage: string; // agent-facing (machine-readable-ish)
  approvalId?: string;
};

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

export type ApprovalRequest = {
  id: string;
  agentId: string;
  toolCall: ToolCall;
  reason: string;
  riskScore: number;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
};

export type AuditEvent = {
  id: string;
  at: string; // ISO timestamp
  agentId: string;
  tool: string;
  argsSummary: string;
  outcome: DecisionOutcome | "executed" | "approval_decided";
  matchedRuleIds: string[];
  riskScore: number;
  explanation: string;
  paypalRef?: string; // mock/live resource id
  approvalId?: string;
};

export type GuardianAgent = {
  id: string;
  name: string;
  description: string;
  trustLevel: "low" | "medium" | "high";
  createdAt: string;
};
