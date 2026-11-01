"use client";

import { Icon } from "./icons";

export type StageCounts = {
  requests: number;
  blocked: number;
  held: number;
  executed: number;
  injection: boolean;
};

const STAGES = [
  { id: "agent", label: "Agent", sub: "MCP tool call", icon: Icon.cpu },
  { id: "policy", label: "Policy engine", sub: "deterministic rules", icon: Icon.shield },
  { id: "risk", label: "Risk model", sub: "heuristics + LLM", icon: Icon.activity },
  { id: "human", label: "Approval", sub: "human in the loop", icon: Icon.inbox },
  { id: "paypal", label: "PayPal", sub: "orders · invoices", icon: Icon.wallet },
] as const;

function Node({
  stage,
  count,
  state,
  running,
}: {
  stage: (typeof STAGES)[number];
  count?: number;
  state: "idle" | "flowing" | "hit" | "gate";
  running: boolean;
}) {
  const color =
    state === "gate" ? "var(--hold)" : state === "hit" ? "var(--block)" : state === "flowing" ? "var(--accent)" : "var(--ink-3)";
  const filled = state !== "idle";
  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 text-center">
      <span
        className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full border transition-colors"
        style={{
          borderColor: filled ? `color-mix(in srgb, ${color} 55%, transparent)` : "var(--line)",
          background: filled ? `color-mix(in srgb, ${color} 12%, transparent)` : "var(--panel)",
          color,
        }}
      >
        {stage.icon({ size: 15 })}
        {running && state === "flowing" && <span className="travel absolute inset-0" />}
      </span>
      <span className="text-[11px] font-medium leading-tight text-ink-2">{stage.label}</span>
      <span className="hidden text-[9.5px] leading-tight text-ink-4 sm:block">{stage.sub}</span>
      {count !== undefined && count > 0 && (
        <span
          className="num rounded px-1 text-[10px] font-bold leading-tight"
          style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="relative mt-4 hidden h-px flex-1 shrink-0 self-start sm:block" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: active ? "var(--accent)" : "var(--line)" }} />
      {active && <div className="travel absolute inset-y-[-1px] left-0 w-1/3" />}
    </div>
  );
}

/**
 * The product's whole argument in one strip: a request enters at the left and
 * has to survive every stage before money moves. Counts appear only after a run,
 * so the strip never decorates without informing.
 */
export function StageFlow({
  counts,
  running,
}: {
  counts: StageCounts | null;
  running: boolean;
}) {
  const stateOf = (id: string): "idle" | "flowing" | "hit" | "gate" => {
    if (running) return "flowing";
    if (!counts) return "idle";
    if (id === "agent") return counts.requests > 0 ? "flowing" : "idle";
    if (id === "policy") return counts.blocked ? "hit" : "flowing";
    if (id === "risk") return counts.injection ? "hit" : "flowing";
    if (id === "human") return counts.held ? "gate" : "flowing";
    return counts.executed ? "flowing" : "idle"; // PayPal is only lit if money actually moved
  };
  // counts appear where a number is meaningful; the risk stage flags presence only
  const countOf = (id: string): number | undefined => {
    if (!counts) return undefined;
    if (id === "agent") return counts.requests;
    if (id === "policy") return counts.blocked || undefined;
    if (id === "risk") return undefined;
    if (id === "human") return counts.held || undefined;
    return counts.executed || undefined;
  };

  return (
    <div className="panel flex flex-wrap items-start gap-y-3 px-3 py-3 sm:flex-nowrap sm:px-4">
      {STAGES.map((s, i) => (
        <div key={s.id} className="contents">
          <Node stage={s} state={stateOf(s.id)} count={countOf(s.id)} running={running} />
          {i < STAGES.length - 1 && <Connector active={running || !!counts} />}
        </div>
      ))}
    </div>
  );
}
