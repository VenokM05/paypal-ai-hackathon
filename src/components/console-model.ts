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
};

export type ScenarioStep = { title: string; output: string };
export type ScenarioResult = { kind: string; steps: ScenarioStep[] };

/**
 * `var(--*)` value paired with a short human label.
 * `wash` is the tinted background used for chips and left rails.
 */
export type Tone = {
  color: string;
  wash: string;
  label: string;
};

const TONES: Record<string, Tone> = {
  allow: { color: "var(--allow)", wash: "var(--allow-wash)", label: "allowed" },
  executed: { color: "var(--allow)", wash: "var(--allow-wash)", label: "executed" },
  approved: { color: "var(--allow)", wash: "var(--allow-wash)", label: "approved" },
  block: { color: "var(--block)", wash: "var(--block-wash)", label: "blocked" },
  denied: { color: "var(--block)", wash: "var(--block-wash)", label: "denied" },
  require_approval: { color: "var(--hold)", wash: "var(--hold-wash)", label: "held" },
  pending: { color: "var(--hold)", wash: "var(--hold-wash)", label: "pending" },
  approval_decided: { color: "var(--accent)", wash: "var(--accent-wash)", label: "decided" },
  rejected: { color: "var(--hold)", wash: "var(--hold-wash)", label: "api rejected" },
  neutral: { color: "var(--ink-3)", wash: "var(--raised)", label: "info" },
};

export function tone(key: string): Tone {
  return TONES[key] ?? { ...TONES.neutral, label: key.replace(/_/g, " ") };
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
  { id: "all", label: "all" },
  { id: "block", label: "blocked" },
  { id: "require_approval", label: "held" },
  { id: "executed", label: "executed" },
  { id: "allow", label: "allowed" },
  { id: "approval_decided", label: "decisions" },
];

export const matchesFilter = (e: Audit, f: string) => f === "all" || e.outcome === f;
