import { NextRequest, NextResponse } from "next/server";
import { decideApproval } from "@/lib/guardian/engine";

export const runtime = "nodejs";

/** POST body: { id, approve: boolean } */
export async function POST(req: NextRequest) {
  const { id, approve } = (await req.json()) as { id: string; approve: boolean };
  const a = decideApproval(id, Boolean(approve), "dashboard");
  if (!a) return NextResponse.json({ error: "approval not found" }, { status: 404 });
  return NextResponse.json({ approval: a });
}
