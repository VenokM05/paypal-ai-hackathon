/**
 * Shared console model: API types, the decision-tone map, and formatting.
 *
 * Tone is derived only from a decision or a state — never chosen for looks.
 * Anything without a decision meaning renders neutral.
 */

export type Agent = {
  id: string;
  name: string;
  description: string;
  trustLevel: string;
};

export type Rule = {
  id: string;
  agentId: string;
  type: string;
  params: Record<string, unknown>;
  action: string;
  reason: string;
  source: string;
  enabled: boolean;
  nlText?: string;
};

export type Approval = {
  id: string;
  agentId: string;
  reason: string;
  riskScore: number;
  status: string;
  createdAt: string;
  decidedAt?: string;
  executed?: boolean;
  toolCall: {
    tool: string;
    recipient?: string;
    amount?: { value: string; currency_code: string };
  };
};

export type Audit = {
  id: string;
  at: string;
  agentId: string;
  tool: string;
  argsSummary: string;
  outcome: string;
  riskScore: number;
  explanation: string;
  paypalRef?: string;
};

export type State = {
  agents: Agent[];
  policies: Rule[];
  approvals: Approval[];
  audit: Audit[];
  paypalMode: string;
  llm: boolean;
  ledger?: string;
};

export type ScenarioStep = { title: string; output: string };
export type ScenarioResult = { kind: string; steps: ScenarioStep[] };

/**
 * `var(--*)` value paired with a short human label.
 * `wash` is the tinted background used for chips and left rails.
 * `tip` is the one-sentence definition shown on hover — the console's vocabulary
 * is security vocabulary, so every state carries its own translation.
 */
export type Tone = {
  color: string;
  wash: string;
  label: string;
  tip: string;
};

const TONES: Record<string, Tone> = {
  allow: { color: "var(--allow)", wash: "var(--allow-wash)", label: "Allowed", tip: "Passed every rule, so the agent was told to continue." },
  executed: { color: "var(--allow)", wash: "var(--allow-wash)", label: "Executed", tip: "Guardian made the PayPal call itself, after a human approved it." },
  approved: { color: "var(--allow)", wash: "var(--allow-wash)", label: "Approved", tip: "A human said yes in the Approvals queue." },
  block: { color: "var(--block)", wash: "var(--block-wash)", label: "Blocked", tip: "A rule refused it outright. The agent is told not to retry." },
  denied: { color: "var(--block)", wash: "var(--block-wash)", label: "Denied", tip: "A human said no in the Approvals queue." },
  require_approval: { color: "var(--hold)", wash: "var(--hold-wash)", label: "Held", tip: "Paused before PayPal, waiting for a person in Approvals." },
  pending: { color: "var(--hold)", wash: "var(--hold-wash)", label: "Waiting", tip: "Still needs your decision — nothing has moved yet." },
  approval_decided: { color: "var(--accent)", wash: "var(--accent-wash)", label: "Decision", tip: "The audit row recording that approve/deny moment." },
  rejected: { color: "var(--hold)", wash: "var(--hold-wash)", label: "PayPal refused", tip: "Guardian allowed it, but the PayPal API answered with an error." },
  neutral: { color: "var(--ink-3)", wash: "var(--raised)", label: "Info", tip: "Context, not a decision." },
};

export function tone(key: string): Tone {
  return TONES[key] ?? { ...TONES.neutral, label: key.replace(/_/g, " "), tip: `Internal state: ${key.replace(/_/g, " ")}.` };
}

export const riskTone = (n: number): Tone =>
  n >= 70 ? TONES.block : n >= 40 ? TONES.pending : TONES.allow;

/** Time as HH:MM:SS — seconds matter when you're reading a velocity loop. */
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

/** Compact relative age for the approval queue ("4m ago"). */
export function fmtAge(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export const money = (amount?: { value: string; currency_code: string }) =>
  amount ? `${amount.currency_code} ${Number(amount.value).toFixed(2)}` : "";

/**
 * The scenario endpoint returns prose, so classify the leading marker once,
 * here, instead of scattering emoji comparisons through the components.
 * Returns a key into the tone map ("block", "require_approval", ...).
 */
export function classifyStep(output: string): string {
  if (output.startsWith("\u{1F6D1}")) return "block"; // 🛑
  if (output.startsWith("\u23F8")) return "require_approval"; // ⏸
  if (output.startsWith("\u2705")) return "executed"; // ✅
  if (output.startsWith("\u26A0")) return "rejected"; // ⚠
  return "neutral";
}

export type TabId = "lab" | "approvals" | "policies" | "audit";

/** Audit filters, in chip order. `all` is the implicit rest, not a real outcome. */
export const AUDIT_FILTERS = [
  { id: "all", label: "All" },
  { id: "block", label: "Blocked" },
  { id: "require_approval", label: "Held" },
  { id: "executed", label: "Executed" },
  { id: "allow", label: "Allowed" },
  { id: "approval_decided", label: "Decisions" },
];

export const matchesFilter = (e: Audit, f: string) => f === "all" || e.outcome === f;

/**
 * Tool names are the API's, so they stay in the audit trail — but nobody reads
 * `send_invoice` as a sentence. This is the human version, used everywhere a
 * tool is described rather than logged.
 */
export const TOOL_LABEL: Record<string, string> = {
  create_payment: "make a payment",
  capture_payment: "capture a payment",
  send_invoice: "send an invoice",
  open_dispute: "open a dispute",
  search_transactions: "search transactions",
  guardian_check_approval: "check on an approval",
  guardian_list_agents: "list the agents",
};

export const toolLabel = (t: string) => TOOL_LABEL[t] ?? t.replace(/_/g, " ");

/** Rule kinds, in the words a person would use to describe what they enforce. */
export const RULE_KIND: Record<string, { label: string; tip: string }> = {
  amount_limit: { label: "Payment size", tip: "Caps what a single payment can be for." },
  daily_total_limit: { label: "Daily total", tip: "Caps the money moved in one calendar day." },
  velocity_limit: { label: "Speed", tip: "Caps how many payments fit in one minute." },
  recipient_allowlist: { label: "Only these recipients", tip: "Nobody else may be paid, whatever the amount." },
  recipient_blocklist: { label: "Never these", tip: "Specific addresses are refused on sight." },
  new_recipient_approval: { label: "New recipient", tip: "The first payment to anyone always needs a human." },
  tool_whitelist: { label: "What it may call", tip: "Scopes which PayPal tools an agent is allowed to use at all." },
  approval_required_tools: { label: "Tools needing a human", tip: "These tools pause for approval even when a rule passes." },
};

/**
 * Trust levels are engine vocabulary (`high` / `medium` / `untrusted`), which
 * reads like a credit rating rather than a permission. This is what each level
 * actually means for what an agent may do.
 */
export const TRUST_LEVEL: Record<string, { label: string; tip: string; kind: string }> = {
  high: { label: "Trusted", tip: "May attempt payments and invoices on its own, within the rules.", kind: "allow" },
  medium: { label: "Limited", tip: "May act, but its riskier requests get held for a person first.", kind: "pending" },
  untrusted: { label: "Read-only", tip: "May look things up but cannot move money at all. Blocked on sight.", kind: "block" },
};

export const trustLevel = (t: string) =>
  TRUST_LEVEL[t] ?? { label: t, tip: `Trust level set for this agent: ${t}.`, kind: "pending" };
