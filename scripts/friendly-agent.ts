/**
 * Friendly demo: a well-behaved shopping agent.
 *   npx tsx scripts/friendly-agent.ts          (approve by hand in the dashboard)
 *   npx tsx scripts/friendly-agent.ts --auto   (auto-approve for quick runs)
 */
import { connectAgent, call, banner } from "./mcp-client";
import { listApprovals } from "../src/lib/db";
import { decideApproval } from "../src/lib/guardian/engine";

async function main() {
  const auto = process.argv.includes("--auto");
  const client = await connectAgent();

  banner("1. Read-only lookup — should pass silently");
  console.log(await call(client, "search_transactions", { agent_id: "shopping-assistant" }));

  banner("2. Normal payment to a new recipient — held for approval");
  const held = await call(client, "agent_pay", {
    agent_id: "shopping-assistant",
    recipient_email: "known-shoppe@example.com",
    amount: { value: "64.99", currency: "USD" },
    note: "Mechanical keyboard requested by the user",
  });
  console.log(held);

  const idMatch = /approval_id: (\S+)/.exec(held);
  if (idMatch) {
    if (auto) {
      await new Promise((r) => setTimeout(r, 500));
      decideApproval(idMatch[1], true, "auto-demo");
      console.log("\n[--auto] Simulated the human clicking Approve in the dashboard.");
    } else {
      console.log(`\n👉 Open http://localhost:3000 and approve ${idMatch[1]}, then press Enter here…`);
      await new Promise<void>((resolve) => process.stdin.once("data", () => resolve()));
    }
    banner("3. Agent polls Guardian — approved action now executes on PayPal");
    console.log(await call(client, "guardian_check_approval", { approval_id: idMatch[1] }));
  }

  banner("4. Repeat payment to the now-known recipient — instant, no hold");
  console.log(await call(client, "agent_pay", {
    agent_id: "shopping-assistant",
    recipient_email: "known-shoppe@example.com",
    amount: { value: "22.50", currency: "USD" },
    note: "Keycap set",
  }));

  console.log(`\nDone. ${listApprovals().length} approval record(s) in the ledger.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
