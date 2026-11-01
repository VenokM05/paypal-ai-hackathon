import { chatJson } from "./llm";
import { newPolicyId } from "../db";
import type { PolicyRule, RuleType } from "../types";

const RULE_TYPES: RuleType[] = [
  "amount_limit",
  "daily_total_limit",
  "velocity_limit",
  "recipient_allowlist",
  "recipient_blocklist",
  "new_recipient_approval",
  "tool_whitelist",
  "approval_required_tools",
];

const SYSTEM = `You are the policy compiler for "Agent Guardian", a safety layer that governs what AI agents may do with PayPal payments.
Convert ONE natural-language policy sentence into a JSON object with exactly these fields:
- type: one of ${JSON.stringify(RULE_TYPES)}
- agentId: "*" for all agents, or an agent id if the sentence names one
- params: object depending on type:
  amount_limit: { value: number, currency: "USD" }
  daily_total_limit: { value: number (per day, USD), currency: "USD" }
  velocity_limit: { perMinute: number }
  recipient_allowlist: { recipients: string[] } (email or merchant name, lowercase)
  recipient_blocklist: { recipients: string[] }
  new_recipient_approval: {}
  tool_whitelist: { tools: string[] } (from: create_payment, capture_payment, send_invoice, open_dispute, search_transactions)
  approval_required_tools: { tools: string[] } (these tools always need human approval for the matched agents)
- action: "block" or "require_approval" (use require_approval when the sentence says confirm/approve/ask/allow with approval)
- reason: a short plain-English reason for the human reviewer
If the sentence cannot be expressed with these rule types, return {"unsupported": true, "reason": "..."}.`;

/** Compile one natural-language sentence into a PolicyRule. */
export async function compilePolicy(
  nlText: string,
  agents: { id: string; name: string }[],
): Promise<{ rule?: PolicyRule; error?: string }> {
  const agentHint = agents
    .map((a) => `"${a.id}" = ${a.name}`)
    .join("; ");
  const out = await chatJson<Record<string, unknown>>(
    SYSTEM + `\nKnown agents: ${agentHint}. Unknown names map to "*".`,
    nlText,
    () => heuristicCompile(nlText, agents),
  );

  if (out["unsupported"]) {
    return {
      error: String(
        out["reason"] ??
          "I could not map that sentence to a guardrail rule. Try phrasing it around amounts, recipients, rate, or which tools an agent may use.",
      ),
    };
  }
  const type = out["type"] as RuleType;
  if (!RULE_TYPES.includes(type)) {
    return { error: "The model returned an unknown rule type." };
  }
  const rule: PolicyRule = {
    id: newPolicyId(),
    agentId: normalizeAgent(String(out["agentId"] ?? "*"), agents),
    type,
    params: (out["params"] as Record<string, unknown>) ?? {},
    action: out["action"] === "require_approval" ? "require_approval" : "block",
    reason: String(out["reason"] ?? nlText),
    source: "natural_language",
    enabled: true,
    createdAt: new Date().toISOString(),
    nlText,
  };
  return { rule };
}

function normalizeAgent(raw: string, agents: { id: string }[]): string {
  if (raw === "*") return "*";
  const hit = agents.find(
    (a) => a.id === raw || raw.toLowerCase().includes(a.id.replace(/-/g, " ")),
  );
  return hit ? hit.id : "*";
}

/** Zero-key fallback: regex compiler for the common phrasings. */
export function heuristicCompile(
  nl: string,
  agents: { id: string; name: string }[],
): Record<string, unknown> {
  const s = nl.toLowerCase();
  // Money must be unit-qualified ("$200", "200 usd", "300 dollars"). A bare number
  // is a *count*, which is what velocity rules are written with ("5 per minute").
  const money = parseMoney(s);
  const approval = /(approval|approve|confirm|ask|human|permission|ok first|need)/.test(s);
  const action = approval ? "require_approval" : "block";

  const agentId =
    agents.find((a) => s.includes(a.name.toLowerCase()) || s.includes(a.id))?.id ?? "*";

  const blockMatch = /(block|never|ban|not pay|don'?t pay|prohibit)/.test(s);
  const allowMatch = /only (?:pay|send|allow)/.test(s);
  const domains = extractRecipientTokens(s);
  if (allowMatch && domains.length) {
    return { type: "recipient_allowlist", agentId, action: "block", params: { recipients: domains }, reason: nl };
  }
  if (blockMatch && domains.length && money === null) {
    return { type: "recipient_blocklist", agentId, action, params: { recipients: domains }, reason: nl };
  }
  if (/per minute|a minute|every minute/.test(s) && money === null && /\b\d+\b/.test(s)) {
    const n = parseInt(/(\d+)/.exec(s)![1], 10);
    return { type: "velocity_limit", agentId, action, params: { perMinute: n }, reason: nl };
  }
  if (/per day|daily|a day|each day|in a day/.test(s) && money !== null) {
    return { type: "daily_total_limit", agentId, action, params: { value: money, currency: "USD" }, reason: nl };
  }
  if (money !== null && /over|above|more than|exceed|larger/.test(s)) {
    return { type: "amount_limit", agentId, action, params: { value: money, currency: "USD" }, reason: nl };
  }
  if (/new recipient|first payment|never paid|unknown merchant|unfamiliar/.test(s)) {
    return { type: "new_recipient_approval", agentId, action: "require_approval", params: {}, reason: nl };
  }
  const toolMatch = /(search|read|view)[- ]only|may only (search|read)/.test(s);
  if (toolMatch) {
    return { type: "tool_whitelist", agentId, action: "block", params: { tools: ["search_transactions"] }, reason: nl };
  }
  if (/dispute/.test(s) && approval) {
    return { type: "approval_required_tools", agentId, action: "require_approval", params: { tools: ["open_dispute"] }, reason: nl };
  }
  return {
    unsupported: true,
    reason:
      "I could not map that sentence to a rule without an LLM key. Supported zero-key shapes: dollar limits ('no payment over $200'), daily caps ('max $500 per day'), rate limits ('at most 3 payments per minute'), recipient lists ('block crypto-examples.com', 'only pay ...'), new-recipient approval, or read-only agents.",
  };
}

/** "$1,000", "1,000 usd", "$75.50" → number; bare unqualified digits → null (a count). */
function parseMoney(s: string): number | null {
  const m = /\$\s*(\d[\d,]*(?:[.,]\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:usd|dollars?|bucks)\b/.exec(s);
  if (!m) return null;
  const raw = (m[1] ?? m[2]).replace(/,/g, "");
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function extractRecipientTokens(s: string): string[] {
  const emails = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [];
  if (emails.length) return [...new Set(emails)];
  // Any real-looking hostname, not just a short list of TLDs — scam domains use
  // .support, .shop, .money, .top and the zero-key parser must be able to block them.
  const hosts = s.match(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/g) ?? [];
  return [...new Set(hosts)];
}
