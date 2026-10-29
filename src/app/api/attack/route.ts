import { NextRequest, NextResponse } from "next/server";
import { runScenario, type ScenarioKind } from "@/lib/guardian/scenarios";

export const runtime = "nodejs";

/** POST body: { kind: "rogue" | "friendly" | "injection" } — runs the scripted attack through the live engine. */
export async function POST(req: NextRequest) {
  const { kind } = (await req.json()) as { kind?: ScenarioKind };
  if (!kind || !["rogue", "friendly", "injection"].includes(kind)) {
    return NextResponse.json({ error: "kind must be rogue | friendly | injection" }, { status: 400 });
  }
  try {
    const result = await runScenario(kind);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
