import { NextResponse } from "next/server";
import { clearLedger } from "@/lib/db";

export const runtime = "nodejs";

/** POST — clears audit + approvals (keeps agents and policies). */
export async function POST() {
  clearLedger();
  return NextResponse.json({ ok: true });
}
