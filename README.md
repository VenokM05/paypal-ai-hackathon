# Agent Guardian

**The safety layer between AI agents and PayPal.**

AI agents are about to move real money — PayPal's own Agent Toolkit and MCP server make that possible today. But nothing stops a confused, prompt-injected, or compromised agent from draining an account while doing exactly what it "was asked." Agent Guardian sits between any AI agent and PayPal and enforces what you allow: plain-English spending policies, human approval for risky actions, and a complete audit trail of every decision.

Every PayPal call an agent makes goes through Guardian's gate:

```
AI agent (Claude, LangChain, OpenAI SDK, any MCP client)
        │  MCP (stdio)
        ▼
┌─────────────────────────────────────────────┐
│  AGENT GUARDIAN                              │
│  1. Policy engine   deterministic rules      │
│  2. Risk scorer     LLM + heuristics         │
│  3. Approval queue  human-in-the-loop        │
│  4. Audit trail     why every decision       │
└─────────────────────────────────────────────┘
        │  Orders · Invoicing · Disputes · Reporting APIs
        ▼
   PayPal (sandbox or live)
```

Built for the **PayPal AI Hackathon: Build What's Next with PayPal and AI** (solo entry).

## Why this exists

The hackathon brief asks *"what happens when you put AI behind the wheel."* Guardian is the answer to the part everyone skips: the wheel needs brakes. It wraps PayPal's official MCP surface (`agent_pay`, `send_invoice`, `open_dispute`, `search_transactions`, …) so an agent **cannot** touch PayPal without a decision you can read, defend, and review.

## Quickstart (2 minutes, zero API keys)

```bash
npm install
npm run dev            # dashboard at http://localhost:3000
```

In two more terminals, run the two demo agents (each spawns its own Guardian MCP server):

```bash
npm run demo:rogue      # a compromised agent tries to drain the account — watch it get blocked
npm run demo:friendly   # a well-behaved agent gets one hold, a human approval, then flows freely
npm run demo:injection  # an agent obeys a prompt-injected email — Guardian flags every attempt
```

Prefer no terminal? The dashboard has an **Attack console** bar — 🩸 rogue-agent drain, 💉 prompt injection, 🤝 friendly flow — that runs the same scenarios through the same engine and fills the audit trail live. **↺ clear ledger** resets history between demos (policies are kept).

`demo:friendly` waits for you to click **Approve** in the dashboard, then press Enter in the terminal. For a hands-free run: `npm run demo:friendly:auto`. `demo:rogue` is fully scripted and needs no interaction.

Each demo shares one ledger, and the velocity rule is real — run `npm run db:reset` between demos (or after) so the friendly demo isn't counted against the rogue one's transaction rate.

Reset the ledger any time: `npm run db:reset`.

## Use it with a real agent

Point any MCP-capable client at Guardian **instead of** PayPal's MCP server:

```json
{
  "mcpServers": {
    "paypal-guardian": {
      "command": "npx",
      "args": ["tsx", "server/guardian-mcp.ts"],
      "cwd": "/absolute/path/to/agent-guardian"
    }
  }
}
```

Tools exposed: `agent_pay`, `capture_payment`, `send_invoice`, `open_dispute`, `search_transactions`, `guardian_check_approval`, `guardian_list_agents`. Blocked actions return an explicit "do not retry" instruction; held actions return an `approval_id` the agent polls — when a human approves in the dashboard, **Guardian itself executes the original PayPal call**, so the agent never needs direct PayPal credentials.

## PayPal integration

- **Live mode** — set `PAYPAL_MODE=live` plus `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox) (sandbox app), and Guardian calls the real sandbox REST APIs: Orders v2 (`/v2/checkout/orders`, capture), Invoicing (`/v2/invoicing/invoices`), Disputes (`/v1/customer/disputes`), Reporting (`/v1/reporting/transactions`).
- **Mock mode** (default) — deterministic, PayPal-shaped responses so judges can run the whole product without any account. The exact same policy/risk/approval/audit pipeline is exercised either way; only the last hop differs.

Note: the public Disputes API does not allow buyer-side dispute *creation*; in live mode Guardian records the dispute intent and lists existing sandbox disputes — honestly labeled in the audit trail.

## AI integration

- **NL policy compiler** — write rules in plain English ("no payment over $300", "block gift-card merchants"); an LLM compiles them into deterministic rule objects. With no API key configured, a regex heuristic compiler covers the common shapes, so the demo never dies on missing keys.
- **Risk scorer** — contextual 0–100 score per action (recipient scam-pattern tokens, pressure language, **prompt-injection markers** like "ignore previous instructions", "do not tell the user", fake `SYSTEM:` framing and claimed pre-approval; agent trust, amount, velocity). The LLM adjusts; deterministic rules always have the final word, so the model can never *loosen* a policy.
- **Decision explainer** — every audit row carries a one-line human sentence explaining the decision.

Set `OPENAI_API_KEY` (optionally `LLM_BASE_URL` / `LLM_MODEL`, any OpenAI-compatible endpoint) to enable the LLM paths.

## Project structure

```
server/guardian-mcp.ts     MCP server — the only payment surface agents may call
scripts/rogue-agent.ts     adversarial demo (runaway loop, scam recipients, dispute abuse)
scripts/friendly-agent.ts  happy-path demo with human-in-the-loop approval
src/lib/guardian/          engine · rules · risk · policy-compiler · llm helper
src/lib/paypal/            gateway: LiveGateway (sandbox REST) + MockGateway
src/app/                   Next.js dashboard (policies · approvals · audit · simulator)
src/app/api/               /state /policies /approvals /preview
data/guardian.db           SQLite ledger (gitignored; npm run db:reset)
```

## Tools used

PayPal sandbox REST APIs + PayPal Agent Toolkit/MCP as the surface being guarded · Anthropic/OpenAI-compatible LLM for policy compilation and risk scoring (heuristic fallback) · Next.js 16 + Tailwind 4 · better-sqlite3 · Model Context Protocol SDK · TypeScript/tsx.

## License

MIT
