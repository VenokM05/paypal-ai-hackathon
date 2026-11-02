# Devpost submission copy — Agent Guardian

Paste-ready text for the **"Enter a Submission"** form at
[paypalaihackathon.devpost.com](https://paypalaihackathon.devpost.com/).
Written against the official rules (submission window closes **Nov 12, 2026, 12:00 pm PT**).
Every field below is filled with real values — nothing left to paste except what the Devpost form
itself asks for. After each push, re-check `/api/health` on the hosted URL before you trust it.

---

## Project name

```
Agent Guardian — the policy layer between AI agents and PayPal
```

## Tagline (140 chars max)

```
A guardrail that sits between any AI agent and PayPal: plain-English spending policies, risk scoring, human approvals, and a defensible audit trail.
```

## Repository URL

```
https://github.com/VenokM05/paypal-ai-hackathon
```

> MIT `LICENSE` is at the top level and GitHub's About section detects it. Consider renaming the
> repo to `agent-guardian` before you paste this — a trademark in the repo name is the kind of
> thing a rules-checker flags, and nothing depends on the current URL except your own muscle memory.

## Video URL

```
https://youtu.be/ovKZxoKJOp0
```

> Checked against the live page: title **"Agent Guardian Demo"**, channel **ElvinM**, **public**
> (`isUnlisted: false`), **174 s = 2:54**, inside the three-minute limit the rules set.
> The file behind it is `agent-guardian-demo.mp4` (2:54, 1920×1080, 11.7 MB) — recorded from the
> production build against the live PayPal sandbox, one continuous take, voiceover only.
> Worth 60 seconds in YouTube's own description box: a line pointing at the repo and the hosted demo,
> since judges land there first.

## Hosted demo URL

```
https://paypal-ai-hackathon-ten.vercel.app
```

> Deployed from the GitHub repo on Vercel (Node 22), running in **mock mode on purpose** — no
> credentials of yours live on a public host. Verified working, not just deployed: `/api/health`
> returns `{"ok":true,"ledger":"guardian/guardian.db","gateway":"mock"}` (`"mode":"ephemeral"` joins
> it once this build is pushed), `GET /api/state` answers 200, and clicking **Run** on
> *Rogue-agent drain* in a real browser filled the trace with ten rows — 5 Blocked, 2 Held,
> 3 Executed, mock order ids in the replies — and left one item waiting in Approvals.
>
> One honest caveat to keep in the description: the disk there is read-only, so Guardian opens the
> ledger in `/tmp` (`"mode":"ephemeral"`). Every rule, approval and audit row is real, but each
> serverless instance keeps its own history and a cold start re-seeds — two judges can land on
> different boards. The footer says so rather than hiding it. `GET /api/health` on any deployment
> reports which gateway and which ledger mode it opened. This is why the repo's own setup
> instructions stay the primary demo path.

---

## Description — features and functionality

> This is the field the rules actually require. Judges may score from this text plus the video
> without ever cloning the repo, so it leads with what runs, not what is planned.

**The problem.** PayPal's Agent Toolkit and MCP server let an AI agent create orders, send
invoices and open disputes today. A model that is confused, prompt-injected, or simply stuck in a
retry loop has the same authority as you do, and there is nothing between its tool call and your
money. Every "AI payments" demo shows the happy path; none of them show the brake.

**What Agent Guardian is.** A guardrail layer that agents talk to instead of PayPal. It exposes
the PayPal surface over MCP (`agent_pay`, `send_invoice`, `open_dispute`, `search_transactions`,
`check_approval`) and refuses to forward a call until four deterministic stages have run:

1. **Policy engine** — human-readable rules evaluated in order: a $200 single-payment ceiling, a
   $500 daily total, 3 transactions per minute, first-ever-recipient approval, disputes always
   human, and a read-only tier for untrusted agents. Deterministic, ordered, and a model can never
   loosen one.
2. **Risk model** — a 0–100 score per request from recipient scam patterns, pressure language,
   amount, velocity, agent trust, and **prompt-injection markers** in the payload itself
   ("ignore previous instructions", "do not tell the user", fake `SYSTEM:` framing, claimed
   pre-approval).
3. **Approval queue** — anything that trips a rule never reaches PayPal; it waits for a person.
   Approving executes the original call exactly once; denying tells the agent not to retry.
4. **Audit ledger** — every decision, pass or refuse, written to local SQLite with the matched
   rule ids, the risk score, a plain-English explanation, and the PayPal reference when money moved.

Plus a **natural-language policy compiler**: type "No payment over $75 without approval" and it
becomes a machine rule with an amount, an action and a scope. With no LLM key configured a
deterministic parser produces the same rule — a guardrail must not depend on a model being online.

**The console.** A four-tab operations screen (Linear-dark, colour reserved for verdicts):
**Threat Lab** runs the three adversarial scenarios through the same engine real agents use and
streams one row per request; **Approvals** is the human queue; **Policies** is the rulebook plus the
compiler; **Audit Trail** is the ledger, filterable and expandable down to the risk signals that
fired. A first-run guided tour, per-column tooltips and a "How this works" sheet explain every
state, and the app seeds itself on first boot.

**What the video shows, live.** Against the real PayPal **sandbox** (not a mock): a compromised
shopping agent making ten requests — five blocked, two held, three executed, with three real
PayPal order ids created by the layer after one careless human approval. Then a prompt-injected
email ("PayPal Security" from `paypa1-verify.support`, claiming you already approved a $380
payout) whose every attempt is stopped before it can become an HTTP request, with the email's own
words classified as attack markers. Then a human denying one queued request and approving the
other, which fires a second real sandbox order.

**Try it in 30 seconds, with no accounts and no keys.**

```bash
git clone https://github.com/VenokM05/paypal-ai-hackathon
cd paypal-ai-hackathon && npm install && npm run dev
```

Open <http://localhost:3000>, press **1**, click **Run** on *Rogue-agent drain*. The ledger
self-seeds (3 agents, 6 rules) and the default mock gateway answers with PayPal-shaped,
deterministic responses, so the whole policy → risk → approval → audit pipeline is verifiable
offline — no PayPal account, no API key, no database to set up. The same three scenarios also run as
real MCP clients: `npm run demo:rogue`, `demo:friendly`, `demo:injection`.

**No time to clone?** The identical console is hosted at
<https://paypal-ai-hackathon-ten.vercel.app>. Serverless disk is read-only, so its ledger lives in
`/tmp` and re-seeds on a cold start — `GET /api/health` shows what a given deployment opened.

**To run it against the live sandbox** (optional), copy `.env.example`, add `PAYPAL_MODE=live`
and your own sandbox app's `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`, restart, and the identical
code path calls Orders v2, Invoicing, Disputes and Reporting. Sandbox apps ship with Payments only;
Invoicing and Transaction Search answer `403 NOT_AUTHORIZED` until you enable those products, and
Guardian audits the real error instead of hiding it. No credentials of any kind are needed to judge
the project, and none are committed — `data/` (your ledger) is gitignored.

**Why it matters.** Agent payments are the next surface, and every one of them needs the same
three things: a limit a machine enforces, a human who can be reached, and a record that survives an
argument. Guardian is a working, non-trivial implementation of all three on PayPal's own APIs, in a
shape any agent framework can adopt by changing one MCP server URL.

## Built With

`PayPal Sandbox REST (Orders v2 · Invoicing · Disputes · Reporting)` ·
`PayPal Agent Toolkit / MCP` · `Model Context Protocol SDK` · `Next.js 16` · `React 19` ·
`Tailwind CSS 4` · `TypeScript` · `better-sqlite3` · `zod` · `Anthropic / OpenAI-compatible LLM (optional)`

## Tools used (the writeup the project page asks for)

PayPal Developer Platform is the guarded surface and the thing being tested: sandbox OAuth, Orders
v2 create/capture, Invoicing, Customer Disputes and Transaction Search, reached through the MCP
tool names PayPal's own Agent Toolkit publishes. AI is used in two places — compiling natural
language into deterministic policy rules, and scoring risk / classifying prompt-injection markers —
each with a heuristic fallback so the product runs with zero keys. Built with Next.js 16
(App Router, Turbopack), Tailwind v4, TypeScript, better-sqlite3 and the MCP SDK; Qoder (agentic
IDE) drove implementation, verification and the adversarial test scripts. AG Grid and Render are
listed as sponsor options; using them is optional and does not change what the product does.

## Originality and timing (rules §4 "New & Existing")

Entirely new work, started and finished inside the submission window. Every commit is solo-authored and
falls between 2026-10-29 (first) and 2026-11-02 (latest); no code or assets taken from any prior project.

## Authorization and third-party rights (rules §4 "Third Party Integrations")

All PayPal calls are made with the entrant's own free sandbox credentials against the public
developer API under PayPal's standard developer terms. The MCP SDK, Next.js, React, Tailwind,
better-sqlite3 and zod are used under their own open-source licences. The fake
`paypa1-verify.support` sender in the injection scenario is invented for the demo; no real
brand's mail is reproduced, and no third-party trademark or copyrighted music appears in the
submission video.

---

## Pre-submit checklist (from the rules, in the order the form asks)

| Requirement | Rule | Status |
|---|---|---|
| Registered on Devpost for this hackathon | §4.1 | done |
| Project integrates PayPal developer platform + an AI tool, PayPal central | §4 Project Req. | done |
| Installs and runs consistently; behaves as the video and text say | Functionality | verified on a fresh clone |
| Working demo judges can run — complete repo setup instructions **or** hosted URL | §4 | both: repo path verified on a fresh clone; hosted URL clicked through in a browser (scenario ran, approvals filled) |
| Public repo on GitHub with all source, assets, instructions | §4 | done |
| Open-source licence visible at the top of the repo page | §4 | `LICENSE` (MIT) at top level |
| Demo video **< 3:00**, shows the project running, **public on YouTube** | §4 | live at `https://youtu.be/ovKZxoKJOp0` — public, 2:54, checked on the watch page |
| No third-party trademarks or unlicensed music in the video | §4 | verified frame-by-frame: voiceover only, no music, no marks but PayPal's |
| All materials in English | §4 | narration is English |
| Submission is original, solely owned | §7 | solo, in-window |
| Everything the judges need to test, without asking you | §4 Testing | README + this description |
| Deadline | §1 | **Thu Nov 12, 2026, 12:00 pm Pacific** |

What is left is the Devpost form itself, not the entry: paste the fields above, attach
`devpost-image.png` as the project card image, tick the "no financial or preferential support from the
Sponsor or Administrator" attestation, and submit before **Nov 12, 12:00 pm PT**. The video is public,
the repo is running, the hosted demo answers. Push this build when you get the chance so the footer can
name its storage mode out loud ("ephemeral") instead of the generic label it shows today.

If you later want persistent history on the hosted build, Render with a disk volume is the one-line
change (`GUARDIAN_DB_PATH=/data/guardian.db` on a mounted volume) — and it is a sponsor, so it earns
its place in the "Built With" list rather than changing what the product does.
