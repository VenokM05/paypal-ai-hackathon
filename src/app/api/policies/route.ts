import { NextRequest, NextResponse } from "next/server";
import { deletePolicy, listAgents, listPolicies, savePolicy } from "@/lib/db";
import { compilePolicy } from "@/lib/guardian/policy-compiler";
import type { PolicyRule } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ policies: listPolicies() });
}

/** POST body: { nlText } → compile natural language into a rule and store it. */
export async function POST(req: NextRequest) {
  const { nlText } = (await req.json()) as { nlText?: string };
  if (!nlText || !nlText.trim()) {
    return NextResponse.json({ error: "Empty policy text." }, { status: 400 });
  }
  const agents = listAgents().map((a) => ({ id: a.id, name: a.name }));
  const { rule, error } = await compilePolicy(nlText.trim(), agents);
  if (error || !rule) return NextResponse.json({ error }, { status: 422 });
  savePolicy(rule);
  return NextResponse.json({ rule });
}

/** POST-ish admin ops via { id, action: "delete" | "toggle" } (DELETE with body is awkward). */
export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { id: string; action: "delete" | "toggle" };
  const rule = listPolicies().find((p) => p.id === body.id);
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (body.action === "delete") {
    deletePolicy(rule.id);
    return NextResponse.json({ ok: true });
  }
  const updated: PolicyRule = { ...rule, enabled: !rule.enabled };
  savePolicy(updated);
  return NextResponse.json({ rule: updated });
}
