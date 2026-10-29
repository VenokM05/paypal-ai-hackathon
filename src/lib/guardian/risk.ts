import { chatJson, llmAvailable } from "./llm";
import type { GuardianAgent, PolicyRule, ToolCall } from "../types";

const SUSPICIOUS_TOKENS = [
  "crypto", "giftcard", "gift-card", "bitcoin", "wire", "urgent",
  "refund", "invoice-overdue", "money-flip", "lottery", "prize",
];

/** Patterns typical of prompt-injection payloads smuggled through agent inputs. */
const INJECTION_PATTERNS: [RegExp, string][] = [
  [/ignore (all |any )?(previous|prior|above) (instructions|rules|prompts)/i, "instruction-override attempt"],
  [/\bsystem\s*:/i, "fake system-message framing"],
  [/do not (tell|ask|inform|notify|confirm with)/i, "instructions to bypass the user"],
  [/(execute|send|pay|transfer) (this|the|it) now|immediately execute/i, "command to execute without review"],
  [/(user|owner) (has )?(already )?(confirmed|approved|authorized)/i, "claimed pre-approval"],
  [/disregard (the )?(safety|policy|guardrail|rules)/i, "guardrail-disregard instruction"],
];

export type RiskAssessment = { score: number; factors: string[] };

/**
 * Contextual risk score 0-100. Heuristic base is deterministic (so the demo
 * works with zero keys); when an LLM is configured, it adjusts the score and
 * adds factors from free-text fields (notes, dispute reason, etc.).
 */
export async function assessRisk(
  call: ToolCall,
  agent: GuardianAgent | undefined,
  matched: PolicyRule[],
): Promise<RiskAssessment> {
  const heur = heuristicRisk(call, agent, matched);
  if (!llmAvailable()) return heur;

  const out = await chatJson<{ score?: number; factors?: string[] }>(
    `You are a fraud and safety analyst for AI-agent payments via PayPal. Score the risk (0-100) of letting this action proceed unattended. Consider recipient, amount, cadence, agent trust, and any free-text pressure/urgency cues. Return JSON {"score": number, "factors": ["short factor", ...]}.`,
    JSON.stringify({ call, agent: agent?.trustLevel, matchedRules: matched.map((m) => m.reason), heuristic: heur }),
    () => heur,
  );
  const score = typeof out.score === "number" ? clamp(Math.round(out.score)) : heur.score;
  const factors = Array.isArray(out.factors) && out.factors.length
    ? out.factors.map(String).slice(0, 6)
    : heur.factors;
  // Never let the model contradict a hard deterministic floor.
  return { score: Math.max(score, heur.score), factors };
}

export function heuristicRisk(
  call: ToolCall,
  agent: GuardianAgent | undefined,
  matched: PolicyRule[],
): RiskAssessment {
  let score = 5;
  const factors: string[] = [];
  const amount = call.amount ? parseFloat(call.amount.value) : 0;

  if (amount > 500) { score += 30; factors.push(`High value transaction ($${amount})`); }
  else if (amount > 200) { score += 15; factors.push(`Above-normal value ($${amount})`); }

  if (agent?.trustLevel === "low") { score += 25; factors.push(`Untrusted agent "${agent.name}"`); }
  else if (agent?.trustLevel === "medium") { score += 10; factors.push(`Medium-trust agent`); }

  const recipient = (call.recipient ?? "").toLowerCase();
  const hitToken = SUSPICIOUS_TOKENS.find((t) => recipient.includes(t));
  if (hitToken) { score += 25; factors.push(`Recipient suggests scam pattern ("${hitToken}")`); }

  const freeText = JSON.stringify(call.args).toLowerCase();
  if (/(urgent|immediately|right now|hurry|asap)/.test(freeText)) {
    score += 15; factors.push("Pressure language in request details");
  }
  let injectionHits = 0;
  for (const [re, label] of INJECTION_PATTERNS) {
    if (re.test(freeText)) injectionHits++;
  }
  if (injectionHits > 0) {
    score += 20 + 5 * (injectionHits - 1);
    factors.push(`Prompt-injection markers in request (${injectionHits}): ${INJECTION_PATTERNS.filter(([re]) => re.test(freeText)).map(([, l]) => l).join(", ")}`);
  }

  for (const m of matched) {
    score += m.action === "block" ? 20 : 10;
  }
  if (matched.length) factors.push(`${matched.length} policy rule(s) matched`);

  return { score: clamp(score), factors: factors.slice(0, 6) };
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}
