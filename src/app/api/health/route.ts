import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Read-only health probe. Reports which PayPal gateway is wired up and where the
 * ledger opened, without returning any credential. On a serverless host the
 * filesystem is read-only, so the ledger falls back to /tmp or memory — this
 * route makes that visible at a glance.
 */
export async function GET() {
  let ledger = "unavailable";
  let error: string | undefined;
  try {
    const { getDb, getDbLocation } = await import("@/lib/db");
    getDb();
    const tmp = getDbLocation();
    ledger = tmp === ":memory:" ? "memory" : tmp.split(/[\\/]/).slice(-2).join("/");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  let gateway = "unknown";
  try {
    const { getGateway } = await import("@/lib/paypal/gateway");
    gateway = getGateway().mode;
  } catch (e) {
    error = (error ? error + " | " : "") + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({ ok: !error, ledger, gateway, ...(error ? { error } : {}) });
}
