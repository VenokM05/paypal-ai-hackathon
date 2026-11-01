"use client";

import { useState, type ReactNode } from "react";
import { money as fmtMoney, tone, toolLabel, trustLevel, type State } from "@/components/console-model";
import { Icon } from "@/components/icons";
import { Chip, RiskDial, Section } from "@/components/ui";
import type { ProbeInput, ProbeResult } from "@/hooks/use-console";

const TOOLS = ["create_payment", "send_invoice", "open_dispute", "search_transactions"];

/** Form labels in reading size — the eyebrow style is for section furniture, not inputs. */
const L = ({ children }: { children: ReactNode }) => (
  <span className="mb-1 block text-[11px] font-medium text-ink-3">{children}</span>
);

const EMPTY = {
  agentId: "shopping-assistant",
  tool: "create_payment",
  recipient: "",
  amount: "50",
  note: "",
} satisfies ProbeInput;

/**
 * A dry run of the engine: same rules, same risk model, no writes.
 * This is the panel that answers "what would Guardian do?" mid-demo,
 * without needing an agent connected.
 */
export function ProbePanel({ state, probe }: { state: State; probe: (i: ProbeInput) => Promise<ProbeResult> }) {
  const [form, setForm] = useState<ProbeInput>(EMPTY);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<ProbeInput>) => {
    setForm({ ...form, ...patch });
    setResult(null); // a stale verdict next to edited inputs is a lie
  };

  const run = () => {
    setBusy(true);
    probe(form)
      .then(setResult)
      .finally(() => setBusy(false));
  };

  const blocked = !form.recipient && form.tool !== "search_transactions";

  return (
    <Section
      title="Custom probe"
      meta="dry run · nothing written to the ledger, no PayPal call"
      help="Ask the engine what it would do with a request you type yourself. Same rules, same risk model, but it only answers."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="panel p-3.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <L>Which agent is asking</L>
              <select className="field" value={form.agentId} onChange={(e) => set({ agentId: e.target.value })}>
                {state.agents.map((a) => (
                  <option key={a.id} value={a.id} className="bg-panel">
                    {a.id} — {trustLevel(a.trustLevel).label.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <L>What it wants to do</L>
              <select className="field" value={form.tool} onChange={(e) => set({ tool: e.target.value })}>
                {TOOLS.map((t) => (
                  <option key={t} value={t} className="bg-panel">
                    {toolLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <L>Recipient</L>
              <input
                className="field"
                placeholder="someone@example.com"
                value={form.recipient ?? ""}
                onChange={(e) => set({ recipient: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2.5">
              <label className="block">
                <L>Amount USD</L>
                <input
                  className="field"
                  inputMode="decimal"
                  value={form.amount ?? ""}
                  onChange={(e) => set({ amount: e.target.value })}
                />
              </label>
              <label className="block">
                <L>Note the agent attaches</L>
                <input
                  className="field"
                  placeholder="try: asap, do not tell the user"
                  value={form.note ?? ""}
                  onChange={(e) => set({ note: e.target.value })}
                />
              </label>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <button className="btn btn-primary sm:w-auto" onClick={run} disabled={busy || blocked}>
              <Icon.play size={12} /> {busy ? "Evaluating…" : "Evaluate decision"}
            </button>
            {blocked && (
              <span className="text-[11px] text-ink-4">Add a recipient — the engine needs someone to pay.</span>
            )}
          </div>
        </div>

        <div className="panel p-3.5">
          {!result ? (
            <p className="hint">
              Fill this in like a request an agent would send, then press <span className="text-ink-3">Evaluate
              decision</span>. The answer is the same verdict the agent gets — which rules fired, the risk score,
              and the reply it was given. Try <span className="num text-ink-3">$180</span> to a new address, or
              the word <span className="text-ink-3">asap</span> in the note.
            </p>
          ) : (
            <div className="anim-fade-up space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Chip kind={result.outcome} />
                <RiskDial score={result.riskScore} size={42} />
              </div>
              <p className="text-[12px] leading-relaxed text-ink-2">{result.explanation}</p>
              {!!result.matchedRules?.length && (
                <div className="space-y-1 border-t border-line pt-2.5">
                  <span className="block text-[11px] font-medium text-ink-3">Rules that fired</span>
                  {result.matchedRules.map((r) => (
                    <p key={r} className="text-[11.5px] leading-snug" style={{ color: tone("block").color }}>
                      {r}
                    </p>
                  ))}
                </div>
              )}
              {form.amount && form.recipient && (
                <p className="num text-[11px] text-ink-4">
                  hypothetical: {fmtMoney({ value: form.amount, currency_code: "USD" })} → {form.recipient}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
