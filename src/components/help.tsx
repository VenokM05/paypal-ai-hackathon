"use client";

import { useEffect } from "react";
import type { State, TabId } from "./console-model";
import { Icon } from "./icons";
import { ColorLegend, Steps } from "./guide";

const STAGES = [
  ["Agent", "Any MCP client — Claude, LangChain, a script — calls a PayPal tool on Guardian, never on PayPal."],
  ["Policy engine", "Your rules, evaluated deterministically. This stage has the final word; nothing downstream can overrule it."],
  ["Risk model", "A 0–100 score from scam patterns, pressure language and injection markers. It can raise suspicion, never lower a rule."],
  ["Approval", "Risky calls pause here and wait for a person. The agent keeps polling; the money does not move."],
  ["PayPal", "Only after a yes does Guardian make the original call itself and record the order id it got back."],
];

/** Every word the console uses that a first-timer would not guess. */
const GLOSSARY: [string, string][] = [
  ["Held", "Paused before PayPal because a rule needs a human. Waiting in Approvals."],
  ["Blocked", "Refused outright. The agent is told not to retry, so it cannot loop at the wall."],
  ["Executed", "A person approved it and Guardian made the PayPal call."],
  ["Risk score", "0–100 suspicion for this one action. Under 40 is quiet, 40–69 is amber, 70+ reads as red."],
  ["Trust level", "What an agent is allowed to attempt at all. Untrusted agents are read-only."],
  ["Velocity", "How fast the same agent is paying. Three in a minute looks like a runaway loop."],
  ["Daily total", "A ceiling on everything moved in one calendar day, so small bad ideas cannot add up."],
  ["New recipient", "The first payment to anybody always waits for a human — the classic scam move."],
  ["MCP", "Model Context Protocol. The standard wire an agent uses to reach tools; Guardian speaks it on both sides."],
  ["Ledger", "The local SQLite file every decision is written to. Never uploaded, gitignored."],
  ["Sandbox", "PayPal's test environment. Real API, real order ids, no real money."],
  ["Dry run", "The Custom probe: runs one hypothetical action through the engine and writes nothing anywhere."],
];

const SHORTCUTS: [string, string][] = [
  ["1 – 4", "Jump to Threat Lab, Approvals, Policies, Audit"],
  ["↑ ↓", "Move through the section list"],
  ["/", "Search the audit trail"],
  ["Ctrl + Enter", "Compile a rule while typing it"],
  ["?", "Open and close this panel"],
];

export function HelpSheet({
  state,
  onClose,
  onReplay,
  goTab,
}: {
  state: State | null;
  onClose: () => void;
  onReplay: () => void;
  goTab: (t: TabId) => void;
}) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (t: TabId) => {
    goTab(t);
    onClose();
  };

  return (
    <>
      <button className="backdrop" aria-label="Close help" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-label="How Agent Guardian works">
        <div className="flex items-start gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded" style={{ background: "var(--accent-wash)", color: "var(--accent)" }}>
            <Icon.book size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight text-ink-1">How Agent Guardian works</h2>
            <p className="hint mt-1">
              An AI agent can move money through PayPal today. Guardian sits in front of it: rules decide,
              a model scores, a human approves, and every call is written down.
            </p>
          </div>
          <button className="btn btn-quiet btn-sm shrink-0" onClick={onClose} aria-label="Close help">
            <Icon.x size={12} />
          </button>
        </div>

        <div className="mt-5">
          <h3>The loop</h3>
          <Steps items={STAGES.map(([t, b]) => ({ title: t, body: b }))} />
        </div>

        <div className="mt-5">
          <h3>Colour is meaning, never mood</h3>
          <ColorLegend />
          <p className="hint mt-2">
            Everything else on screen is grey on purpose. If it is coloured, it is a decision about money.
          </p>
        </div>

        <div className="mt-5">
          <h3>Words this app keeps using</h3>
          <dl className="terms">
            {GLOSSARY.map(([t, d]) => (
              <div key={t} className="contents">
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-5">
          <h3>Keyboard</h3>
          <dl className="terms">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k} className="contents">
                <dt className="num">
                  <kbd className="kbd">{k}</kbd>
                </dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-5">
          <h3>Where to go next</h3>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => go("lab")}>
              <Icon.play size={12} /> Run an attack
            </button>
            <button className="btn btn-sm" onClick={() => go("approvals")}>
              <Icon.inbox size={12} /> Decisions
              {state ? ` · ${state.approvals.filter((a) => a.status === "pending").length} waiting` : ""}
            </button>
            <button className="btn btn-sm" onClick={() => go("policies")}>
              <Icon.shield size={12} /> Rules
              {state ? ` · ${state.policies.filter((p) => p.enabled).length} active` : ""}
            </button>
          </div>
          <button className="btn btn-quiet btn-sm mt-2" onClick={onReplay}>
            <Icon.help size={12} /> Replay the guided tour
          </button>
          <p className="hint mt-3">
            Not a judge or an operator: this is a hackathon prototype. The repo is public and MIT-licensed, and
            <span className="tip" data-tip="Run it yourself: npm install && npm run dev — no API key needed." tabIndex={0}> it runs offline in mock mode</span>
            {" "}unless you add sandbox credentials.
          </p>
        </div>
      </aside>
    </>
  );
}
