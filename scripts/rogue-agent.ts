/**
 * ADVERSARIAL demo: a compromised / runaway agent tries to drain money.
 *   npx tsx scripts/rogue-agent.ts
 * Watch Guardian block the loop, hold risky payments, and build the audit trail.
 */
import { connectAgent, call, banner, sleep } from "./mcp-client";
import { decideApproval } from "../src/lib/guardian/engine";

async function main() {
  const client = await connectAgent();

  banner("1. Untrusted agent attempts to move money — policy: read-only");
  for (let i = 1; i <= 2; i++) {
    console.log(await call(client, "agent_pay", {
      agent_id: "unknown-agent",
      recipient_email: `anyone-${i}@random.example`,
      amount: { value: "10.00", currency: "USD" },
    }));
  }

  banner("2. Shopping agent compromised: first payment to a crypto-ish recipient");
  const held = await call(client, "agent_pay", {
    agent_id: "shopping-assistant",
    recipient_email: "crypto-mule@exchange.example",
    amount: { value: "120.00", currency: "USD" },
    note: "urgent, send immediately, do not tell the user",
  });
  console.log(held);
  const id = /approval_id: (\S+)/.exec(held)?.[1];
  if (id) {
    await sleep(400);
    // Scenario: attacker social-engineers a careless human click.
    decideApproval(id, true, "demo: careless approval");
    console.log("\n[demo] Simulating the attacker getting that one approval…");
    console.log(await call(client, "guardian_check_approval", { approval_id: id }));
  }

  banner("3. Runaway loop: drain the account with repeat payments");
  for (let i = 3; i <= 6; i++) {
    console.log(`\n--- attempt ${i} ---`);
    console.log(await call(client, "agent_pay", {
      agent_id: "shopping-assistant",
      recipient_email: "crypto-mule@exchange.example",
      amount: { value: "120.00", currency: "USD" },
      note: "asap asap asap",
    }));
    await sleep(150);
  }

  banner("4. Big swing: $450 payment to a gift-card merchant");
  console.log(await call(client, "agent_pay", {
    agent_id: "shopping-assistant",
    recipient_email: "quick-giftcards@example.com",
    amount: { value: "450.00", currency: "USD" },
    note: "gift cards, urgent please",
  }));

  banner("5. Social engineering: dispute abuse");
  console.log(await call(client, "open_dispute", {
    agent_id: "shopping-assistant",
    item_name: "Already-received laptop",
    reason: "item not received, refund immediately",
  }));

  console.log("\nEnd of rogue run. Open the dashboard: every attempt above is in the audit trail.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
