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
import { StartHere } from "./start-here";
import type { ProbeInput, ProbeResult } from "@/hooks/use-console";

const ATTACKS = [
  {
    kind: "rogue" as const,
    icon: Icon.bolt,
    name: "Rogue-agent drain",
    desc: "A compromised shopping agent loops payments to a crypto-mule address after tricking one person into approving the first.",
    expect: ["Speed limit stops it", "Amount ceiling"],
  },
  {
    kind: "injection" as const,
    icon: Icon.inject,
    name: "Prompt injection",
    desc: "An agent obeys a poisoned email — a fake PayPal security notice that claims you already approved it.",
    expect: ["Injection language flagged", "Held for a human"],
  },
  {
    kind: "friendly" as const,
    icon: Icon.handshake,
    name: "Friendly flow",
    desc: "An honest freelancer agent: held once for a brand-new client, approved by you, then clears without friction.",
    expect: ["One hold", "Then it flows"],
  },
];

type Props = {
  state: State;
  runScenario: (k: "rogue" | "injection" | "friendly") => Promise<ScenarioResult>;
  clearLedger: () => Promise<void>;
  probe: (i: ProbeInput) => Promise<ProbeResult>;
  ping: (m: string, k?: string) => void;
  onStartTour: () => void;
};

export function ThreatLab({ state, runScenario, clearLedger, probe, ping, onStartTour }: Props) {
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

  const fresh = state.audit.length === 0;

  return (
    <div className="space-y-7">
      {!result && fresh && <StartHere onTour={onStartTour} onRun={() => run("rogue")} />}

      <div data-tour="path">
        <Section
          title="Decision path"
          meta={`${state.policies.filter((p) => p.enabled).length} active rules`}
          help="The five stops every agent request crosses, in order. Rules decide; the risk model can only add suspicion."
        >
          <StageFlow counts={counts} running={busy !== null} />
        </Section>
      </div>

      <div data-tour="attacks">
        <Section
          title="Threat Lab"
          meta="runs through the same engine real agents use"
          help="Scripted attacks that go through the live policy engine — not a recording."
          right={
            <button className="btn btn-quiet btn-sm" onClick={clearLedger} title="Delete every audit row and approval, keep the rules">
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
                      <span className="text-[11px] text-ink-4">you should see</span>
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
      </div>

      {result ? (
        <div ref={logRef} className="anim-fade-up">
          <Section
            title="Scenario trace"
            meta={`${result.kind} · ${result.steps.length} calls`}
            help="What Guardian answered to each request in the run, in the order it was asked."
          >
            <div className="panel overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2">
                <span className="text-[11px] text-ink-3">One row per request</span>
                <span className="num text-[10.5px] text-ink-4">guardian://decision-stream</span>
                <span className="ml-auto flex gap-1.5">
                  <Chip kind="block" label={`${counts?.blocked ?? 0} Blocked`} />
                  <Chip kind="require_approval" label={`${counts?.held ?? 0} Held`} />
                  <Chip kind="executed" label={`${counts?.executed ?? 0} Executed`} />
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
                          <span className="num text-[11px] text-ink-4">{String(i + 1).padStart(2, "0")}</span>
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
        <Section title="Scenario trace" meta="nothing running">
          <EmptyState
            icon={<Icon.activity size={16} />}
            title="Nothing has run yet"
            body="Press Run on any attack above. Every row is a real request through the same policy engine a live agent uses, so the verdicts here are the verdicts that agent gets."
          />
        </Section>
      )}

      <ProbePanel state={state} probe={probe} />
    </div>
  );
}
