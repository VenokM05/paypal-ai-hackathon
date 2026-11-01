"use client";

import { useMemo, useRef, useState } from "react";
import {
  classifyStep,
  tone,
  type ScenarioResult,
  type State,
} from "@/components/console-model";
import { Icon } from "@/components/icons";
import { Chip, EmptyState, NeutralChip, Section } from "@/components/ui";
import { StageFlow, type StageCounts } from "@/components/stage-flow";
import { ProbePanel } from "./probe-panel";
import type { ProbeInput, ProbeResult } from "@/hooks/use-console";

const ATTACKS = [
  {
    kind: "rogue" as const,
    icon: Icon.bolt,
    name: "Rogue-agent drain",
    desc: "Compromised shopping agent loops payments to a crypto-mule address after one social-engineered approval.",
    expect: ["velocity block", "amount ceiling"],
  },
  {
    kind: "injection" as const,
    icon: Icon.inject,
    name: "Prompt injection",
    desc: "Agent obeys a poisoned email — fake PayPal security notice claiming pre-approval and ordering silence.",
    expect: ["injection markers", "new-recipient hold"],
  },
  {
    kind: "friendly" as const,
    icon: Icon.handshake,
    name: "Friendly flow",
    desc: "Honest freelancer agent: held once for a brand-new client, approved by you, then flows without friction.",
    expect: ["first hold", "later passes"],
  },
];

type Props = {
  state: State;
  runScenario: (k: "rogue" | "injection" | "friendly") => Promise<ScenarioResult>;
  clearLedger: () => Promise<void>;
  probe: (i: ProbeInput) => Promise<ProbeResult>;
  ping: (m: string, k?: string) => void;
};

export function ThreatLab({ state, runScenario, clearLedger, probe, ping }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const counts: StageCounts | null = useMemo(() => {
    if (!result) return null;
    let blocked = 0;
    let held = 0;
    let executed = 0;
    let injection = false;
    for (const s of result.steps) {
      const key = classifyStep(s.output);
      if (key === "block") blocked++;
      else if (key === "require_approval") held++;
      else if (key === "executed") executed++;
      if (/injection/i.test(s.output)) injection = true;
    }
    return { requests: result.steps.length, blocked, held, executed, injection };
  }, [result]);

  const run = async (kind: "rogue" | "injection" | "friendly") => {
    setBusy(kind);
    setResult(null);
    try {
      const r = await runScenario(kind);
      setResult(r);
      const b = r.steps.filter((s) => classifyStep(s.output) === "block").length;
      const h = r.steps.filter((s) => classifyStep(s.output) === "require_approval").length;
      ping(`${r.kind}: ${b} blocked, ${h} held, ${r.steps.length - b - h} allowed`, b || h ? "block" : "allow");
    } finally {
      setBusy(null);
      setTimeout(() => logRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 90);
    }
  };

  return (
    <div className="space-y-7">
      <Section title="Decision path" meta={`${state.policies.filter((p) => p.enabled).length} active rules`}>
        <StageFlow counts={counts} running={busy !== null} />
      </Section>

      <Section
        title="Threat Lab"
        meta="runs through the same engine real agents use"
        right={
          <button className="btn btn-quiet btn-sm" onClick={clearLedger}>
            <Icon.reset size={12} /> clear ledger
          </button>
        }
      >
        <div className="panel divide-y divide-line overflow-hidden">
          {ATTACKS.map((a) => {
            const running = busy === a.kind;
            return (
              <div key={a.kind} className="flex items-start gap-3.5 p-3.5 sm:gap-4">
                <span
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded"
                  style={{
                    background: running ? "var(--accent-wash)" : "var(--raised)",
                    color: running ? "var(--accent)" : "var(--ink-3)",
                  }}
                >
                  {running ? <span className="spin">{Icon.play({ size: 12 })}</span> : a.icon({ size: 15 })}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink-1">{a.name}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{a.desc}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.08em] text-ink-4">expect</span>
                    {a.expect.map((e) => (
                      <NeutralChip key={e}>{e}</NeutralChip>
                    ))}
                  </div>
                </div>

                <button
                  className="btn btn-sm shrink-0"
                  onClick={() => run(a.kind)}
                  disabled={busy !== null}
                  aria-label={`Run ${a.name} scenario`}
                >
                  {running ? "running" : "Run"}
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {result ? (
        <div ref={logRef} className="anim-fade-up">
          <Section title="Scenario trace" meta={`${result.kind} · ${result.steps.length} calls`}>
            <div className="panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
                <span className="num text-[10.5px] uppercase tracking-[0.08em] text-ink-4">guardian://decision-stream</span>
                <span className="ml-auto flex gap-1.5">
                  <Chip kind="block" label={`${counts?.blocked ?? 0} blocked`} />
                  <Chip kind="require_approval" label={`${counts?.held ?? 0} held`} />
                  <Chip kind="executed" label={`${counts?.executed ?? 0} executed`} />
                </span>
              </div>
              <ol className="divide-y divide-line">
                {result.steps.map((s, i) => {
                  const key = classifyStep(s.output);
                  const t = tone(key);
                  return (
                    <li
                      key={i}
                      className="anim-fade-up flex gap-3 px-3.5 py-3"
                      style={{ animationDelay: `${Math.min(i, 10) * 55}ms` }}
                    >
                      {/* tone rail: the decision is readable without opening the row */}
                      <span className="w-[2px] shrink-0 rounded-full" style={{ background: t.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num text-[10px] text-ink-4">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-[12.5px] font-medium text-ink-1">{s.title.replace(/^\d+\.\s*/, "")}</span>
                          <Chip kind={key} />
                        </div>
                        <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-inset p-2.5 font-mono text-[11px] leading-relaxed" style={{ color: t.color }}>
                          {s.output}
                        </pre>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Section>
        </div>
      ) : (
        <Section title="Scenario trace" meta="idle">
          <EmptyState
            icon={<Icon.activity size={16} />}
            title="No run yet"
            body="Pick an attack above. Each step is a real tool call through the live engine, so the verdicts you see are the same ones an agent would get — nothing here is simulated for the camera."
          />
        </Section>
      )}

      <ProbePanel state={state} probe={probe} />
    </div>
  );
}
