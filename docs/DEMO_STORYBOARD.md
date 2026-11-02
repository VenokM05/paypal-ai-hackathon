# Demo storyboard — Agent Guardian (2:45)

Companion to [`DEMO_NARRATION.md`](DEMO_NARRATION.md) and [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md).
Everything here was measured on **2026-11-02** against the live PayPal sandbox
(`PAYPAL_MODE=live`, no LLM key, the 6 seeded policies, ledger cleared before each take),
driven through the real UI at 1920×1080. Quotes are verbatim screen text.

## 1. Scene list

| # | Scene | Screen type | Tab | Visual anchor | Est. |
|---|---|---|---|---|---|
| m00 | The problem | real operation | Threat Lab | Decision path strip: Agent → Policy engine → Risk model → Approval → PayPal | 15s |
| m01 | The rulebook | real operation | Policies | 6 rules, then the compiled `$75` rule appears as row 7 | 24s |
| m02 | Rogue agent drain | real operation | Threat Lab | Scenario trace streams 10 rows; chips `5 Blocked / 2 Held / 3 Executed` | 48s |
| m03 | The receipts | real operation | Approvals → Audit Trail | Deny the dispute, then the audit table with 3 PayPal ids | 17s |
| m04 | Prompt injection | real operation | Threat Lab → Audit Trail | 4 trace rows, then the expanded risk-signals sentence | 35s |
| m05 | The human decides | real operation | Approvals | `Denied` + `Executed` chips, live order id in the toast | 14s |
| m06 | Close | real operation | Threat Lab | Custom probe verdict card: `Held`, dial `15` | 16s |

Total 2:49 of screen time against a 3:00 cap. No overlay/title cards — every second is
real product, which is what the Design and Presentation criteria reward here.

## 2. Survey record (interaction points, verified)

No login, no session, no scrolling needed at 1920×1080. Tab keys: `1` Threat Lab,
`2` Approvals, `3` Policies, `4` Audit Trail.

| Scene | One-line interaction | Selector / control | Measured |
|---|---|---|---|
| m01 | Type the rule, press Compile & enforce, then delete it | `textarea[aria-label="Policy in plain English"]` → button `Compile & enforce` → row's `Delete this rule` icon button | compile ≈ 1.2 s, delete ≈ 0.4 s |
| m02 | Run the rogue drain | `[aria-label="Run Rogue-agent drain scenario"]` | 3.7 s to stream all 10 rows |
| m03 | Deny the held dispute | first pending card → button `Deny` | toast in ≈ 0.4 s |
| m03 | Expand an audit row | click any `tbody tr`; detail row is `#event-<id>` | instant |
| m04 | Clear the ledger, then run the injection | button `clear ledger` → `[aria-label="Run Prompt injection scenario"]` | 0.9 s for 4 rows |
| m05 | Deny the `$380`, approve the `$190` | pending card containing `380` → `Deny`; card containing `190` → `Approve & execute` | approve ≈ 1.5 s (real PayPal round trip) |
| m06 | Probe with defaults + a recipient | `input[placeholder="someone@example.com"]` → button `Evaluate decision` | instant, writes nothing |

### Verbatim values the narration quotes

* Rogue drain, fresh ledger: **10 calls · 5 Blocked · 2 Held · 3 Executed**, audit gains 11 rows.
* Row 04 output: `✅ Executed (PayPal live): Sandbox PayPal order <17 chars> created: USD 120.00, status CREATED.`
* Row 09: `Big swing: $450 to a gift-card merchant` → Blocked, **risk 100**, four rules named in one line.
* Approvals after the rogue run: `1 open · 1 decided` — the open item is the dispute at risk **30**.
* Injection, cleared ledger: `1 Blocked / 2 Held / 0 Executed` — `$380` held at **95**, untrusted invoice blocked at **100**, `$190` held at **60**.
* Expanded injection row: `Risk signals: Above-normal value ($380); Recipient suggests scam pattern ("gift-card"); Prompt-injection markers in request (3): instruction-override attempt, instructions to bypass the user, claimed pre-approval; 2 policy rule(s) matched.`
* Approve-and-execute toast: `Approved — Executed (PayPal live): Sandbox PayPal order <id> created: USD 190.00, status CREATED.`
* Custom probe (`shopping-assistant`, `make a payment`, new recipient, `50`): **Held**, risk **15**, rule fired: `First-ever payment to a new recipient needs a human OK.`

## 3. Risk list — read before pressing record

1. **Verdicts depend on ledger state.** Velocity and daily-total counters are computed from the
   ledger, so running the injection *after* the rogue drain turns its two holds into three blocks at
   risk 100. The scene order above bakes the required resets in: clear at the top of m04, nothing else.
2. **Adding the `$75` rule changes every later verdict.** Verified the bad way: with that rule still
   installed, the same rogue run left **5 open items** in the approval queue instead of 1, and the
   `1 sent to PayPal` line no longer matched the narration. Delete it at the end of m01.
3. **Record the build, not the dev server.** `npm run build && npm run start` — the Next.js dev
   badge sits in the bottom-left corner of every dev-mode frame and the hot-reload indicator
   flickers. Production mode removes it.
4. **Three real sandbox orders per take** (status `CREATED`, nothing captured, no money moves).
   Approving in m05 adds a fourth. Sandbox only, your own account; if you retake four times that is
   ~16 orders in the sandbox activity list. Harmless, but do not narrate an id.
5. **Never show credentials.** No `.env.local`, no `/api/state` JSON, no DevTools Network tab, no
   Render env screen. The PayPal client id appears in the sandbox dashboard, so keep that tab closed.
6. **Do not run the Friendly flow in live mode.** Its `search_transactions` and `send_invoice` calls
   hit `403 NOT_AUTHORIZED` (those products are off on the sandbox app) and the trace renders a
   warning row. It is fine in mock mode only.
7. **The approve toast lasts 2.8 s.** Hold the mouse over the button, let it appear, then let the
   cut land on the `Executed` chip in the *Already decided* table, which is permanent.
8. **First-load tour.** A brand-new profile opens the 6-step guided tour over everything. Dismiss it
   (Skip, or `localStorage.setItem("guardian.tour.v1","done")`) before the take starts, not during.
9. **Audio and rights.** No music bed under the voiceover unless it is licence-free and quiet; no
   third-party logos or trademarks on screen; the only brand shown is PayPal's, as the product being
   guarded. Mic check first — Game Bar is known to record silent video.
10. **If a number disagrees on camera, keep recording** and say what the screen says. The chips and
    the table are the source of truth; this document is the map, not the territory.

## 4. Trim list if the assembly runs long

Cut in this order; each is a clean removal that leaves the surrounding sentences grammatical:
m01 "Untrusted agents are read-only." (the rail shows it) · m02 "Not a mock." ·
m03 "That is what a risk team needs afterwards." · m04 "Open the row." · m06 "and writes nothing".
Dropping all five saves about 9 seconds.

## 5. Recorded take (what actually shipped)

`agent-guardian-demo.mp4` — 174.4 s (2:54 of a 3:00 cap), 1920×1080 h264 + AAC 48 kHz, 11.7 MB.
Recorded from the **production build** (`npm run build && npm run start`) against the live PayPal
sandbox, seven real-operation scenes, one continuous take: the ledger is reset before m02, m04 clears
it, and every scene heals its own precondition, so any single scene re-records with `--scenes mNN`.
Voiceover is `en-US-AndrewMultilingualNeural` at +7%; no music, no third-party marks, no credentials
and no DevTools or `.env` frame anywhere in the cut.

Two things the frame check caught and fixed, both worth knowing before a retake:

1. **m02's closing count needs the chips on screen.** "Five blocked, two held, three executed" is
   said at 43–47 s, but the `5 Blocked / 2 Held / 3 Executed` chips live in the trace *header*, which
   scrolls out of view as soon as the cursor points at row 01. The scene now scrolls the header back
   into view at 41 s and rests the cursor on `3 Executed`.
2. **m04 must expand the payment row, not the invoice row.** Both contain "380", and `filter(hasText)`
   picks the invoice — whose signals list only two markers. The narration reads out three
   (`instruction-override attempt, instructions to bypass the user, claimed pre-approval`), which only
   the `$380 make a payment` row carries, so the selector is now
   `rows.filter(hasText "380").filter(hasText "make a payment")`.

The recorder starts the webm a beat before the scene's `t0` (goto + mount + settle ≈ 1.1–2.1 s) and
compose trims the tail, not the head, so every action lands ~1.5 s after the audio that cues it. m02's
pointing beats are shifted 1.2 s early to absorb that; the rest read fine inside their own sentences.
