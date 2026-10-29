import { NextResponse } from "next/server";
import { listAgents, listApprovals, listAudit, listPolicies } from "@/lib/db";
import { getGateway } from "@/lib/paypal/gateway";
import { llmAvailable } from "@/lib/guardian/llm";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    agents: listAgents(),
    policies: listPolicies(),
    approvals: listApprovals(),
    audit: listAudit(120),
    paypalMode: getGateway().mode,
    llm: llmAvailable(),
  });
}
