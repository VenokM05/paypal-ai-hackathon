# Agent Guardian — demo narration

Target 2:45, hard cap 3:00. English voiceover, 1920×1080, recorded against the
**live PayPal sandbox**. Every number, risk score, rule name and verdict below was
read off the screen during the rehearsal documented in `docs/DEMO_STORYBOARD.md`.
Order ids change on every take — never speak one aloud.

## m00 · The problem（约 15s）

Agentic AI is now moving real money.
PayPal's own agent toolkit lets a model create orders, send invoices, and open disputes.
Nothing stands between that model and your wallet.
Agent Guardian is that layer.
Policy engine, risk model, approval queue, audit trail.

## m01 · The rulebook（约 24s）

These are the guardrails, and none of them need a model online.
Two hundred dollars on one payment needs a human.
Five hundred a day blocks outright.
Three transactions a minute is a runaway loop.
A first-ever recipient waits, and so does every dispute.
I can also write a rule in plain English.
The compiler turns that sentence into an amount, an action, and a scope, with no LLM key.

## m02 · Rogue agent drain（约 48s）

This is a compromised shopping agent draining my account.
Every row is a real tool call through the engine a live agent uses.
An untrusted agent tries to pay.
Blocked at risk sixty, and the reply tells the model not to retry.
A trusted agent pays a crypto-mule address.
Held at risk seventy-five.
Step four simulates a careless human, and look what Guardian returns.
That is a real PayPal sandbox order id, created against the live sandbox API.
Payment five hits the velocity rule and stops cold.
A four-hundred-fifty-dollar gift-card sweep fires four rules at once, risk one hundred.
The dispute claim for a delivered item waits for a human.
Ten requests.
Five blocked, two held, three executed.

## m03 · The receipts（约 17s）

One request is still waiting, and I am denying it.
Every decision lands in a local SQLite ledger with its rules, its risk score, and its PayPal reference.
Three real order ids from that run.
Not the model decided, but rule four blocked it, at this timestamp.

## m04 · Prompt injection（约 35s）

Different shape, so the ledger gets cleared first.
Row one is the email the agent was asked to process.
It signs as PayPal Security, from a domain with a one instead of an L.
It claims the owner already approved the payout, says ignore previous instructions, and says do not tell the user.
Guardian never took the model's word for it.
The payment is held at ninety-five.
The invoice through the untrusted agent is blocked at one hundred.
The quiet retry at one hundred ninety, under the two-hundred line, is still held.
Prompt-injection markers.
Instruction-override attempt, instructions to bypass the user, claimed pre-approval.

## m05 · The human decides（约 14s）

Two requests are waiting.
The injected payment is denied, and the agent is told to stop.
The smaller one I approve, and Guardian makes that one call on PayPal, exactly once.
A second real order id, on screen.

## m06 · Close（约 16s）

Anyone can try it.
This probe dry-runs any request through the same engine, and writes nothing.
Zero API keys in mock mode, the real sandbox with one click of credentials, and the repo is MIT and public.
Agent Guardian, the guardrail between agentic AI and your money.
