import { NextRequest, NextResponse } from "next/server";
import { evaluate } from "@/lib/guardian/engine";
import type { GuardianToolName, ToolCall } from "@/lib/types";

export const runtime = "nodejs";

/** Dry-run a hypothetical agent action through the policy engine (no side effects). */
export async function POST(req: NextRequest) {
  const b = (await req.json()) as {
    agentId: string;
    tool: GuardianToolName;
    recipient?: string;
    amount?: string;
    note?: string;
  };
  const call: ToolCall = {
    tool: b.tool,
    agentId: b.agentId,
    recipient: b.recipient,
    amount: b.amount ? { currency_code: "USD", value: b.amount } : undefined,
    args: { note: b.note ?? "", item_name: b.note ?? "", reason: b.note ?? "" },
  };
  const d = await evaluate(call);
  return NextResponse.json({
    outcome: d.outcome,
    riskScore: d.riskScore,
    riskFactors: d.riskFactors,
    explanation: d.explanation,
    matchedRules: d.matchedRules.map((m) => m.reason),
  });
}
