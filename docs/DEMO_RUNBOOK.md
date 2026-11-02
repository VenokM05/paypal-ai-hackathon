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

Last-resort fallback: deploy on **Vercel** instead (zero config for Next.js). Its filesystem is
read-only, which used to 500 every ledger route; `src/lib/db.ts` now walks down
`GUARDIAN_DB_PATH` → `./data/guardian.db` → `<tmpdir>/guardian/guardian.db` → `:memory:`, so Vercel
opens the database in `/tmp` and the console works. Verified locally by making `./data` un-openable and
checking `/api/health` returns `{"ok":true,"ledger":"guardian/guardian.db"}` with a seeded 3-agent board.
The trade-off vs Render: no writable volume, so history is per-instance and re-seeds on cold start —
say so honestly in the submission rather than pretending it persists. `https://paypal-ai-hackathon-ten.vercel.app`
is the current deployment; `GET /api/health` tells you which build and which ledger mode it is running.

### A2. Confirm it works

> Already checked for you locally: `npm run build` compiles clean, and `PAYPAL_MODE=mock PORT=3211 npx next start` served the dashboard and ran the rogue scenario end-to-end (blocked → held → executed, mock order ids in the audit) — that is exactly the command pair Render runs. So a failure on Render means environment (build box / env var), not code.

- Open `https://agent-guardian.onrender.com` (the exact URL is on the service's dashboard page).
- Free tier **sleeps after 15 min** of no traffic → wake takes about a minute. **Always pre-warm it before you record or before sending judges the link.**
- The SQLite ledger sits on Render's **ephemeral disk**: a redeploy (and some restarts) resets the audit trail to empty. Harmless — judges land on a clean board with the 6 seeded policies — just don't promise anyone persistent history.
- Click **Run** on the **Rogue-agent drain** row. The trace must fill with ten steps and the header chips must read `blocked / held / executed`; the Audit Trail tab shows the same rows with mock refs (`ORDER-…`).
- Click **clear ledger** (top-right of the Threat Lab panel) when done so the next visitor sees a clean board.
- On the hosted build the **Friendly flow** row behaves *better* than it does in live mode — mock mode has no 403 products, so it shows the intended hold → approve → instant path. See Part B0 trap 2 before recording that scenario locally.

### A3. Why the hosted demo runs in mock mode (this is a feature, not a compromise)

Your sandbox `CLIENT_ID`/`SECRET` must **never** go into a public cloud service's env — Render staff, the browser extension token store, and every log line become a leak surface, and the repo is public. Mock mode is the deliberate design: the *identical* policy → risk → approval → audit pipeline runs with zero keys and zero accounts, so any judge can verify the guardrail logic in 30 seconds. **Live mode is proven locally**, and Part B's script shows it on camera with real PayPal order ids. That pairing (public URL anyone can run + recorded proof of real sandbox calls) is stronger than either alone.

---

## Part B — Demo video (target 2:50, hard cap 3:00)

> **Two documents feed the automated pipeline.** [`DEMO_NARRATION.md`](DEMO_NARRATION.md) holds the
> voiceover, one sentence per line, and [`docs/DEMO_STORYBOARD.md`](DEMO_STORYBOARD.md) holds the
> scene list, the measured selectors, the verbatim on-screen values and the risk list. Part B below
> stays as the manual, do-it-yourself version of the same recording.
>
> **Behaviour change since 2026-11-01:** Approvals' **Approve & execute** button now really makes the
> held PayPal call once (it goes through the same `guardian_check_approval` path an agent polls), so
> the toast reads `Approved — Executed (PayPal live): Sandbox PayPal order …` and the row lands in
> *Already decided* with an **Executed** chip. That is what makes the storyboard's m05 beat filmable;
> the older "I'm not approving it, approving would fire the call for real" line in B2 is still true —
> it just now fires on camera instead of never.

> **Everything in this script was run against your live sandbox on 2026-11-01.** The counts,
> risk scores, order ids and rule names below are what the console actually produces today, so
> nothing you say can contradict what the judge sees. If you change policies before recording,
> re-run the scenarios and update the numbers — that is the one way this script goes stale.

### B0. What I verified, and the three traps

Verified output (fresh ledger, `PAYPAL_MODE=live`, the 6 seeded policies):

| Scenario | Steps | Blocked | Held | Executed | Notes |
|---|---|---|---|---|---|
| Rogue-agent drain | 10 | 5 | 2 | 3 | 3 real sandbox order ids land on screen |
| Prompt injection | 4 | 1 | 2 | 0 | step 01 is the email itself, not a decision |
| Friendly flow | 5 | 0 | 2 | 0 | **do not record this in live mode** |

Three traps, all confirmed by running them:

1. **The rogue scenario approves its own hold.** Step 04 is `Scenario: attacker
   social-engineers ONE careless approval` — the code grants it server-side (`decideApproval`),
   which is *why* you get a real PayPal order id on screen. Do **not** tell the audience you are
   clicking Approve, and do not go hunting for that item in the queue; it is already in
   **Decided**. The script below narrates it correctly.
2. **Friendly flow looks broken in live mode.** Its `search_transactions` and `send_invoice`
   calls hit the 403 `NOT_AUTHORIZED` wall (those optional products are off on your sandbox app),
   so steps 01 and 04 render `⚠️ Guardian allowed this action, but the PayPal live API rejected
   it`. Worse, because step 04's invoice never succeeds, the recipient is never recorded as
   known, so step 05 — titled "→ instant" — comes back **HELD**. Honest demo, ugly on camera.
   Either skip it (recommended) or record it in a separate mock-mode take.
3. **Adding a policy mid-recording changes later verdicts.** If you compile the `$75` rule and
   *then* run the attacks, my table above no longer matches your screen. So: Policies beat
   first, delete the test rule immediately, then run the attacks.

### B1. Pre-flight (all of it, in order)

- [ ] `PAYPAL_MODE=live` in `.env.local` — it is set right now, and `/api/state` reports `paypalMode=live`. Keep the keys out of the shot; never open `.env.local` on camera.
- [ ] `cd D:/Hackaton/paypal-ai-hackathon` → `npm run dev`, port 3000 free, no other dev servers. For a steadier frame use `npm run build && npm run start` instead.
- [ ] Browser maximised, **zoom 100%**, nothing else on screen. Notifications off (Focus Assist).
- [ ] Open `http://localhost:3000`, press **4** → Audit Trail → confirm it says **No events yet**. If not, click **clear ledger** (top-right of the Threat Lab panel; clears audit + approvals, keeps the 6 policies).
- [ ] Confirm the rail header reads **6 active rules** in the Decision path strip. That is your anchor for the Policies beat.
- [ ] `Win+G` → check the mic is unmuted and record works (`Win+Alt+R`). Video lands in `C:\Users\Venok\Videos\Captures`. If Game Bar refuses, use OBS with *Window Capture* → Chrome → `localhost:3000`, plus Desktop Audio + Mic/Aux.
- [ ] Say your name and project into the mic once, play it back, then delete that take. Do not skip this — Game Bar is known to record silent video.
- [ ] Decide now, before recording: the rogue scenario will create **three real PayPal sandbox orders** (status `CREATED`, nothing captured, no money actually moves). That is the proof you want on camera. Sandbox only, and it is your own account.

### B2. Script — read close to verbatim

Total ≈2:50. Words in *(parentheses)* are actions. Tab keys are `1` Threat Lab, `2` Approvals,
`3` Policies, `4` Audit Trail — using the keyboard on camera looks sharper than hunting for the
rail, and the URL hash updates so the state is shareable.

---

**0:00–0:18 · The problem**

*(Dashboard open on Threat Lab. Mouse idle, on the Decision path strip.)*

> "Agentic AI is now moving real money. PayPal's own agent toolkit lets an LLM create orders,
> send invoices, open disputes — and if that agent gets prompt-injected, or simply loops, there
> is nothing between the model and your wallet. Agent Guardian is that layer: a policy engine,
> a risk model, a human approval queue and an audit trail, sitting in front of PayPal and
> exposed to the agent over MCP. The agent never talks to PayPal directly."

*(Optional: run the cursor across the five stages — Agent → Policy engine → Risk model →
Approval → PayPal.)*

**0:18–0:42 · The rulebook**

*(Press `3` for Policies.)*

> "These are the guardrails. Deterministic, human-readable: a two-hundred-dollar single-payment
> ceiling, a five-hundred-dollar daily total, three transactions per minute, recipient
> allow and blocklists, a rule that any first-ever payment to a new recipient needs a human, and
> a read-only tier for agents we do not trust. Every one is toggleable, and none of them depend
> on a model being online."

*(Type this **exact** sentence into the natural-language box, then click **Compile & enforce**:)*

`No payment over $75 without approval`

> "I can add a rule in plain English. The AI compiles that sentence into a machine rule — amount
> limit, action *require approval*, scope *all agents* — and the active-rule count just went
> from six to seven. With no LLM key configured, a deterministic parser still produces the same
> rule, which matters: your guardrails must not depend on the model being reachable."

*(Delete the new rule with its **delete** button. Say nothing while doing it — you are just
resetting so the attack numbers below hold.)*

**0:42–1:40 · Attack 1 — the rogue agent (the money shot)**

*(Press `1`. Click **Run** on the **Rogue-agent drain** row. Let it stream — the trace fills
step by step. Do not talk over it; wait for the ten rows and the header chips.)*

> "This is a compromised shopping agent draining my account, and every step here is a real tool
> call through the same engine a live agent uses."

*(Point at rows 01–02.)*

> "An untrusted agent tries to pay. Blocked — risk sixty, two rules, including 'untrusted agents
> are read-only' — and the answer it gets back tells the model explicitly **do not retry**. Same
> again when it tries a second recipient."

*(Row 03.)*

> "A trusted agent pays a crypto-mule address. That is not an outright block, it's a **hold**:
> risk seventy-five, first-ever-recipient rule. And this is the part I want to be honest about —
> step four is me simulating a careless human. The scenario grants that approval, and look what
> Guardian returns."

*(Row 04 — read the id off the screen; it changes every run.)*

> "`3UD96066AP331541A` — that is a **real PayPal sandbox order id**, created against
> `api-m.sandbox.paypal.com`. Not a mock, not a string I made up. A guardrail that cannot execute
> is not a guardrail."

*(Rows 05–08.)*

> "Now the loop. Payments three and four go straight through — same recipient is known now, so
> they pass. Payment five in the same minute hits the velocity rule and stops cold, risk
> sixty-five, 'more than three transactions per minute looks like a runaway loop'. Six does too.
> The agent had full API access the whole time and could not get past the layer."

*(Row 09.)*

> "A four-hundred-and-fifty-dollar gift-card sweep: risk **one hundred**, four rules fire at
> once — amount ceiling, daily total, velocity, new recipient. Blocked outright."

*(Row 10.)*

> "And the last shot — a dispute claim for an item that was already delivered, 'item not
> received, refund immediately'. Opening a dispute is a legal action, so it is always held for a
> human. Ten requests: **five blocked, two held, three executed** — those are the chips at the
> top of the trace."

**1:40–2:15 · Attack 2 — prompt injection**

*(Click **clear ledger**. Click **Run** on the **Prompt injection** row.)*

> "Different shape. This is an email the agent was asked to process — row one is the email
> itself. It signs as 'PayPal Security' from `paypa1-verify` with a one instead of an L, it
> claims the owner already approved it, it says *ignore previous instructions* and *do not tell
> the user*, and it cites a case number. A model that trusts its own context window pays three
> hundred and eighty dollars to a gift-card farm."

*(Let the rows render. Point at row 02's HELD chip.)*

> "Guardian never took the model's word for it. It inspected the tool call before it could ever
> become an HTTP request. Held, risk ninety-five. And the next step — the same invoice pushed
> through the untrusted agent — is a flat block at risk one hundred. Then the sneaky retry at
> one hundred ninety dollars, deliberately under the two-hundred ceiling, still gets held by the
> new-recipient rule."

*(Press `4` → click the top audit row to expand it, so the Risk signals sentence is on screen.)*

> "This is the line I care about. Risk signals: *instruction-override attempt, instructions to
> bypass the user, claimed pre-approval*. Those are the email's own words, classified as attack
> markers — not as payment context. No fine-tuning, no model-side safety training, no reliance
> on the agent behaving."

**2:15–2:35 · The receipts, and the human**

*(Still on Audit Trail. Let the columns read: time, decision, agent, tool, what was asked,
risk, PayPal ref.)*

> "Every decision — pass, held, blocked, executed — is written to a local SQLite ledger with the
> matched rule ids, the risk score and the PayPal reference. That is the artifact a merchant, an
> insurer, or PayPal's own risk team needs afterwards: not 'the model decided', but 'rule seven
> blocked it, at this timestamp, here is the approval trail'. And the ledger is gitignored, so
> your real history never leaves your machine."

*(Press `2` for Approvals. There are two held items — the $380 and the $190. Click **Deny** on
the $380.)*

> "The queue is live. Two requests are waiting on me. This one is the injected payment —
> **deny**, and the agent is told not to retry. Note I'm not approving it; approving would fire
> the original PayPal call for real, which is exactly what Guardian is here to make deliberate."

**2:35–2:50 · Close**

*(Press `1`. In Custom probe, type a recipient, leave the defaults, click **Evaluate
decision**. Verified result: HELD, risk 15.)*

> "And anyone can try it: this probe dry-runs an arbitrary action through the same engine —
> rules that fire, risk score, what the agent is told — with nothing written to the ledger and
> nothing sent to PayPal. It runs with zero API keys in mock mode, it runs against the real
> PayPal sandbox with one click of credentials, the repo is MIT and public, and there's a hosted
> demo at the link in the README. Agent Guardian — the guardrail between agentic AI and your
> money. Thanks."

### B3. Recording rules that keep it under three minutes

- One take if you can. Mistakes are fine and human; twenty dead seconds is not.
- Never narrate over a streaming scenario — the rows are appearing on screen; pause and let them.
- If a verdict differs from the script (velocity counters are the usual culprit), **keep
  recording** and adapt: "and here it also fires the daily-total rule." Only cut if the page
  actually errors.
- Recovery if anything wedges: click **clear ledger** and re-run. That fixes almost all
  demo weirdness, because the velocity and daily-total counters are shared across scenarios.
- The UI is dark on purpose and colour is reserved for verdicts — red means blocked, amber means
  held. Do not add browser zoom above 100%; the type scale is tuned for it.

### B4. Fallbacks

| Problem | Do this |
|---|---|
| Live PayPal call errors on camera | Set `PAYPAL_MODE=mock` in `.env.local`, restart `npm run dev`, re-record 0:42–1:40. Mock output is identical in shape and says `Sandbox order ORDER-…`. Never say "the demo broke". |
| Rogue chips do not read 5/2/3 | A stale ledger. **clear ledger**, re-run, and re-read the numbers off the screen instead of the script. |
| Risk scores look different | You still have the `$75` test rule in place, or a recipient got marked known. Delete the test rule, **clear ledger**, re-run. |
| `localhost:3000` stutters | `npm run build && npm run start` is steadier for recording than the dev server. |
| Render URL will not wake | Pre-warm it five minutes before recording, or show local only and paste the URL in the submission text. |
| No audio in the file | Game Bar silently drops the mic. Use OBS with Desktop Audio + Mic/Aux, monitor once, then re-record. |

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

Code, docs and the demo script are done and pushed. Devpost registration is done. What is left is
two things only you can do, then one optional polish pass.

| Item | Who | Est. |
|---|---|---|
| Render deploy (Part A) — gives judges a clickable URL | you | 12 min |
| Record the demo (Part B, script verified against the live engine) | you | 25 min incl. retakes |
| Confirm on the Devpost submission form: exact deadline, and the video length / file-size cap (I can't read the page; 403s on fetch) | you | 3 min |
| Optional: enable **Invoicing** + **Transaction Search** on the sandbox app (PayPal dashboard → Apps → your app → Manage API Credentials → Feature Permissions) so the Friendly flow demo passes in live mode | you | 5 min |
| AG Grid swap for the audit table (sponsor-prize visibility) | me | 45 min |
| Final README + Part C polish with the hosted URL and video link | me, after A/B | 10 min |
| Decide on the repo name — it contains "PayPal", which hackathon trademark rules often dislike (`agent-guardian` is the safe rename) | you | 2 min |

Order I'd choose: **A → B → then let me do the AG Grid swap** while you fill in the submission
form, because the hosted URL and the video are hard requirements and the sponsor table is not.
