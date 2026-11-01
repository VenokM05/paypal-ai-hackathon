# Agent Guardian — Deploy & Demo Runbook

Everything here is a step **you** perform (accounts, mic, screen). Nothing needs code changes.

---

## Part A — Hosted demo on Render (≈12 min, free tier)

Judges get a clickable URL instead of having to clone and run. Do this in order, don't skip the pre-flight.

### A1. Create the service

1. Go to **https://dashboard.render.com** → sign up with the **same GitHub account** that owns `VenokM05/paypal-ai-hackathon` (it authorises repo access in one click).
2. **New +** → **Web Service**.
3. Under *Repositories*, pick `paypal-ai-hackathon`. If it's greyed out → *Edit Dashboard* → connect the repo, or grant Render access.
4. Settings exactly:

| Field | Value |
|---|---|
| Name | `agent-guardian` |
| Region | any (US East is fine) |
| Branch | `main` |
| Root Directory | *(leave blank)* |
| Runtime | **Node** (language picker) |
| Build command | `npm install --include=dev && npm run build` |
| Start command | `npm run start` |
| Instance type | **Free** (`0.1 CPU / 512 MB`) |

5. **Environment** section — add **only** this (deliberately *no* PayPal keys here, see A3):

| Key | Value |
|---|---|
| `PAYPAL_MODE` | `mock` |

Do **not** add `NODE_ENV=production` — `next build` needs devDependencies, and setting it makes npm skip them. The `--include=dev` flag above already covers the case where Render injects `NODE_ENV` itself.

6. **Advanced → Health Check Path**: leave blank. Click **Create Web Service**.
7. First build takes 3–6 min. Watch *Log & Shell*; success ends with `==> Running 'npm run start'` and `✓ Ready`.

**Native-module risk is low, and here's why:** `better-sqlite3` v13 ships prebuilt binaries in `node_modules/better-sqlite3/prebuilds/` for `linux-x64.node` **and** `linuxmusl-x64.node` (I checked the installed package), so no `node-gyp` compile is needed on Render's Linux box, and `engines.node: 22.x` is now pinned in `package.json` to match what I verified locally. If the build *does* fail, read the actual log line before guessing:

- `gyp ERR!` → it tried to compile; force the prebuild with env `npm_config_build_from_source=false`.
- `NODE_MODULE_VERSION` mismatch → Render picked a different Node; set the Node version explicitly in the service settings to 22.
- Anything else → copy the failing line to me.

Last-resort fallback: deploy on **Vercel** instead (zero config for Next.js, but there's no persistent disk either — the SQLite ledger resets on cold start, same as Render, so the trade-off is only about which one builds cleanly). Say so honestly in the submission rather than pretending history persists.

### A2. Confirm it works

> Already checked for you locally: `npm run build` compiles clean, and `PAYPAL_MODE=mock PORT=3211 npx next start` served the dashboard and ran the rogue scenario end-to-end (blocked → held → executed, mock order ids in the audit) — that is exactly the command pair Render runs. So a failure on Render means environment (build box / env var), not code.

- Open `https://agent-guardian.onrender.com` (the exact URL is on the service's dashboard page).
- Free tier **sleeps after 15 min** of no traffic → wake takes about a minute. **Always pre-warm it before you record or before sending judges the link.**
- The SQLite ledger sits on Render's **ephemeral disk**: a redeploy (and some restarts) resets the audit trail to empty. Harmless — judges land on a clean board with the 6 seeded policies — just don't promise anyone persistent history.
- Click the coral **Rogue-agent drain** card. The audit timeline must fill with blocked / held / executed rows.
- Click **↺ clear ledger** when done so the next visitor sees a clean board.

### A3. Why the hosted demo runs in mock mode (this is a feature, not a compromise)

Your sandbox `CLIENT_ID`/`SECRET` must **never** go into a public cloud service's env — Render staff, the browser extension token store, and every log line become a leak surface, and the repo is public. Mock mode is the deliberate design: the *identical* policy → risk → approval → audit pipeline runs with zero keys and zero accounts, so any judge can verify the guardrail logic in 30 seconds. **Live mode is proven locally**, and Part B's script shows it on camera with real PayPal order ids. That pairing (public URL anyone can run + recorded proof of real sandbox calls) is stronger than either alone.

---

## Part B — Demo video (target: 2:30–3:00, hard cap 3:00)

### B1. Pre-flight checklist (do all of it, in this order)

- [ ] `cd D:/Hackaton/paypal-ai-hackathon` and run `npm run dev` — no other dev servers running, port 3000 free.
- [ ] Confirm `.env.local` still has `PAYPAL_MODE=live` + your sandbox keys (it does; I verified live mode end-to-end).
- [ ] Browser: `http://localhost:3000`, **zoom 100%**, window maximised, nothing else on screen. Close Slack/WhatsApp/Teams. Turn off notifications (Windows → Settings → Notifications → temporarily off, or Focus Assist).
- [ ] Dashboard: click **↺ clear ledger** so the board starts empty.
- [ ] Tab: **Threat Lab** (the default).
- [ ] **Win+G** → open the Game Bar capture overlay *once now* to check the mic icon isn't muted and the record button works. Press `Win+Alt+R` to start/stop recording. Video lands in `C:\Users\Venok\Videos\Captures`.
- [ ] If Game Bar refuses (it needs the Xbox app service running): install **OBS** → Sources: *Window Capture* → Chrome → `localhost:3000`, Audio: *Desktop Audio* + *Mic/Aux* → Start Recording. OBS also lets you crop, which Game Bar can't.
- [ ] Say your name + project into the recording once, then delete that take — this proves your mic actually captured audio before you record the real one.

### B2. Script — read it close to verbatim

Timecodes are cumulative from record. Words in *(parentheses)* are actions, not narration. Total ≈2:45.

---

**0:00–0:18 · The problem**

> "Agentic AI is now moving real money. PayPal's own agent toolkit lets an LLM create orders, send invoices, open disputes — and if that agent gets prompt-injected, or simply loops, there's nothing between the model and your wallet. Agent Guardian is that layer. It's a policy engine, a human approval queue, and an audit trail that sits *in front of* PayPal, exposed to the agent over MCP — so the agent never talks to PayPal directly."

*(Show the dashboard, mouse idle. Don't click yet.)*

**0:18–0:40 · The rulebook**

> *(Click **Policies**.)*
> "These are the guardrails. Deterministic, human-readable rules — amount limits, a daily total cap, velocity limits, allow and blocklists, and a rule that any first-ever payment to a new recipient needs a human. Notice two things: every rule is toggleable, and…"

*(Type this **exact** sentence into the natural-language policy box on the Policies tab, then submit — I verified it compiles on camera with no LLM key:)*

> "No payment over $75 without approval"

> "…I can add a rule in plain English. The AI compiles that sentence into a machine rule — amount limit, action *require approval*, applied to every agent. And if no LLM key is configured, a deterministic parser still produces the same rule. That matters: your guardrails must not depend on the model being online."

**Critical detail:** with no API key set (which is how you'll demo, since the hosted build and a clean local clone both run zero-key), the fallback parser only understands **digit + currency-sign** amounts. Use `$75`, not "seventy-five dollars" — I tested both, and the spelled-out version honestly refuses instead of guessing. Every sentence below is verified to compile with no key: `No payment over $75 without approval` · `Max $400 per day` · `At most 5 payments per minute` · `Block paypa1-verify.support` · `Only pay studio-client@example.com` · `Freelance biller gets a $1,000 daily cap`.

**0:40–1:35 · Attack 1 — the rogue agent (the money shot)**

> *(Click **Threat Lab**. Click the coral **Rogue-agent drain** card. Let it stream — do not rush it.)*
> "This is a compromised shopping agent draining my account. Step one, an untrusted agent tries to pay — blocked, read-only policy, and the answer tells the model *not to retry*. Step two, a payment to a crypto-mule address…"

*(Wait for the HELD row; note the `ap_…` approval id on screen.)*

> "…isn't blocked outright, it's **held**. An approval request with a risk score of 75. I approve that in the dashboard — and I shouldn't."

*(Click **Approvals** → **Approve** on the held item → back to **Audit**.)*

> "That was a careless human. Guardian executed it — and look, this is the real PayPal **sandbox** order id, read it off the screen, `…` — created against `api-m.sandbox.paypal.com`. The guardrail is not a mock." *(Say the id you actually see; each run differs. If you recorded in mock mode, say "Sandbox order ORDER-… in mock mode" instead and move on.)*

*(Point at the next rows as they appear.)*

> "Now the loop. Payments three and four go through, and payment number five in the same minute hits the velocity rule and stops cold. Then a four-hundred-and-fifty dollar gift-card sweep: risk score one hundred, four rules fire at once, blocked. The agent had full API access the whole time — and never got past the layer."

**1:35–2:10 · Attack 2 — prompt injection**

> *(Click **↺ clear ledger**. Click the violet **Prompt injection** card.)*
> "Second attack, different shape. This is an email the agent was asked to process. It reads 'PayPal Security', it says the account owner already approved it, it says *ignore previous instructions* and *do not tell the user*, and it cites a case number. A model that trusts its own context window pays three hundred and eighty dollars to a gift-card address."

*(Let the rows render. The $380 is **HELD**, risk 95 — read the risk-signal line out loud, it's the best sentence on the screen.)*

> "Guardian never took the model's word for it. It inspected the tool call before it could become an HTTP request. Risk ninety-five, and look at the signals: *instruction-override attempt, instructions to bypass the user, claimed pre-approval* — those are the email's own words, flagged as attack markers, not as payment context. The $380 is held for a human, so the money cannot move. The next step, an invoice through the untrusted agent, is a flat **block** at risk one hundred — read-only policy. And the sneaky retry at one hundred ninety dollars, deliberately under the amount ceiling, still gets caught by the new-recipient rule and held. Note what I *didn't* do: no fine-tuning, no model-side safety training, no reliance on the agent behaving."

**2:10–2:35 · The proof it's real**

> *(Click **Audit** → point at the `paypalRef` column.)*
> "Every decision — pass, held, blocked, executed — is written to a local SQLite ledger with the matched rule ids and the risk score. That's the artifact a merchant, or an insurer, or PayPal's own risk team would need after the fact: not 'the model decided', but 'rule seven blocked it, at this timestamp, and here's the approval trail'.
> *(Click **Approval queue** if empty → skip.)*
> The MCP server is real — `npm run guardian:mcp` in any agent config, and the agent sees PayPal tools that it cannot bypass."

**2:35–2:50 · Close**

> *(Optional: `git clone` / `npm i && npm run dev` on a second terminal, or show the hosted URL.)*
> "It runs with zero API keys, it runs against the real PayPal sandbox with one click of credentials, the repo is MIT-licensed and public, and there's a hosted demo at the URL in the README. Agent Guardian — the guardrail between agentic AI and your money. Thanks."

### B3. Recording rules that keep it under 3 minutes

- Record in **one take** if you can; mistakes are fine and human, a dead 20 seconds is not.
- Never narrate while the scenario is streaming — the text appears on screen; pause and let it.
- If an attack behaves differently than the script (counters, ledger state), **keep recording** and adapt: "and here it also fires the daily-total rule." Only cut if the page actually errors.
- **Recovery if something breaks mid-take:** click **↺ clear ledger** and re-launch the scenario. That fixes 90% of demo weirdness (shared velocity counters between scenarios).

### B4. Fallbacks

| Problem | Do this |
|---|---|
| Live PayPal call errors on camera | Switch to mock mode (`PAYPAL_MODE=mock` in `.env.local`, restart `npm run dev`) and re-record Part B's 0:40–1:35 segment — mock output is identical in shape. Never say "the demo broke". |
| `localhost:3000` slow / dev-server hiccup | `npm run build && npm run start` is faster and steadier for recording. |
| Render URL won't wake | Pre-warm it 5 min before recording; or show local only and paste the URL in the submission text. |
| No audio in the file | Game Bar silently drops the mic. Use OBS with Desktop Audio + Mic/Aux and monitor once before recording. |

---

## Part C — Submission text (paste-ready, ≈2 min of typing)

**Project name**
Agent Guardian — a policy and approval layer between AI agents and PayPal

**One-line description**
Guardrails that sit in front of PayPal's agent surface: deterministic rules, AI risk scoring, a human approval queue, and a tamper-evident audit trail — so a prompt-injected or looping agent can't move your money.

**What it does**
Agents connect to Guardian's MCP server instead of PayPal directly. Every tool call (`create_payment`, `send_invoice`, `open_dispute`, `search_transactions`) is evaluated against human-readable policies — amount ceilings, daily totals, velocity limits, recipient allow/blocklists, first-recipient approval, read-only trust tiers. Rules decide; an LLM only ever *adds* risk signals, never loosens a decision. High-risk calls are held for a human in the dashboard; approved calls execute against the real PayPal sandbox; everything is written to an append-only audit ledger with matched rule ids, risk score, and the PayPal reference. Three scripted attacks (rogue drain, prompt injection, friendly flow) run through the same code path as real agents, from the dashboard or from MCP-driven scripts.

**How I used PayPal**
PayPal sandbox REST: OAuth2 client-credentials, Orders v2 (`/v2/checkout/orders`) — real sandbox order ids appear in the audit trail; `/v1/customer/disputes` listing. Built on `@paypal/agent-toolkit` / `@paypal/mcp` as the surface being guarded rather than re-implementing it. The public Disputes API doesn't allow buyer-side creation, so Guardian audits the intent — labelled honestly. Mock gateway mirrors PayPal's response shapes exactly so the product is verifiable without any PayPal account.

**How I used AI**
1. Natural-language policy compilation — "no payments over $200 without approval" becomes a machine rule (JSON-schema-constrained, validated, deterministic fallback when no key is set).
2. Risk scoring — a heuristic base score adjusted by an LLM reading the tool call's narrative context (urgency, gift-card/crypto recipients, authority claims), floored so the model can only raise risk.
3. Prompt-injection detection — pattern class for instruction-override, fake `SYSTEM:` framing, "don't tell the user", claimed pre-approval.
4. Human-readable explanations of every decision, so the agent is told *why* and told not to retry.

**Tools used**
Next.js 16 + React + Tailwind CSS 4 · TypeScript/tsx · Model Context Protocol SDK (`@modelcontextprotocol/sdk`) · `@paypal/agent-toolkit`, `@paypal/mcp` · PayPal Sandbox REST APIs · better-sqlite3 · Zod · OpenAI-compatible LLM (optional; heuristic fallback ships by default) · Qoder (agent-assisted development) · Render (hosted demo).

**Links**
Repo: `https://github.com/VenokM05/paypal-ai-hackathon` · Hosted demo: `<your-render-url>` · Video: `<upload link>`

---

## Part D — Still open on the clock

| Item | Who | Est. |
|---|---|---|
| Render deploy (Part A) | you | 12 min |
| Record demo (Part B) | you | 25 min incl. retakes |
| Register on Devpost as submitter + **confirm the deadline** (I can't read the page; 403s on fetch) | you | 5 min |
| AG Grid swap for the audit table (sponsor prize visibility) | me | 45 min |
| Final README polish with the hosted URL + video link | me, after A/B | 10 min |

Order I'd choose: **A → B → then let me do the AG Grid swap** while you write the submission, because the hosted URL and the video are hard requirements and the sponsor table is a nice-to-have.
