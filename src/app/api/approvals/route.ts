import { NextRequest, NextResponse } from "next/server";
import { decideApproval } from "@/lib/guardian/engine";
import { checkApproval } from "@/lib/guardian/dispatch";

export const runtime = "nodejs";

/**
 * POST body: { id, approve: boolean }
 *
 * Approving runs the held call on PayPal right here, through the same
 * guardian_check_approval path an agent polls — so the "Approve & execute"
 * button, the ledger, and the agent's own view of the world all agree.
 * checkApproval is one-shot: a second click returns "already executed"
 * instead of moving money twice.
 */
export async function POST(req: NextRequest) {
  const { id, approve } = (await req.json()) as { id: string; approve: boolean };
  const a = decideApproval(id, Boolean(approve), "dashboard");
  if (!a) return NextResponse.json({ error: "approval not found" }, { status: 404 });
  const execution = approve ? await checkApproval(id) : undefined;
  return NextResponse.json({ approval: a, execution });
}
