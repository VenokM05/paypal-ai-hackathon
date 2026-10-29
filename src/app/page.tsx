"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ───────────────────────────  data types  ─────────────────────────── */

type Agent = { id: string; name: string; description: string; trustLevel: string };
type Rule = {
  id: string; agentId: string; type: string; params: Record<string, unknown>;
  action: string; reason: string; source: string; enabled: boolean; nlText?: string;
};
type Approval = {
  id: string; agentId: string; reason: string; riskScore: number; status: string;
  createdAt: string; decidedAt?: string;
  toolCall: { tool: string; recipient?: string; amount?: { value: string; currency_code: string } };
};
type Audit = {
  id: string; at: string; agentId: string; tool: string; argsSummary: string;
  outcome: string; riskScore: number; explanation: string; paypalRef?: string;
};
type State = {
  agents: Agent[]; policies: Rule[]; approvals: Approval[]; audit: Audit[];
  paypalMode: string; llm: boolean;
};
type ScenarioStep = { title: string; output: string };

/* ───────────────────────────  tiny helpers  ─────────────────────────── */

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const TONE: Record<string, { fg: string; bg: string; label: string }> = {
  allow: { fg: "var(--mint)", bg: "var(--mint-soft)", label: "allowed" },
  executed: { fg: "var(--mint)", bg: "var(--mint-soft)", label: "executed" },
  approved: { fg: "var(--mint)", bg: "var(--mint-soft)", label: "approved" },
  block: { fg: "var(--coral)", bg: "var(--coral-soft)", label: "blocked" },
  denied: { fg: "var(--coral)", bg: "var(--coral-soft)", label: "denied" },
  require_approval: { fg: "var(--amber)", bg: "var(--amber-soft)", label: "held" },
  pending: { fg: "var(--amber)", bg: "var(--amber-soft)", label: "pending" },
  approval_decided: { fg: "var(--guardian)", bg: "var(--guardian-soft)", label: "decided" },
};

const tone = (k: string) => TONE[k] ?? { fg: "var(--muted)", bg: "rgba(139,160,184,.1)", label: k.replace("_", " ") };

function Badge({ kind, children }: { kind: string; children?: React.ReactNode }) {
  const t = tone(kind);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: t.fg, background: t.bg }}
    >
      {children ?? t.label}
    </span>
  );
}

function RiskGauge({ score, size = 58 }: { score: number; size?: number }) {
  const color = score >= 70 ? "var(--coral)" : score >= 40 ? "var(--amber)" : "var(--mint)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 60 60" width={size} height={size} className="-rotate-90">
        <circle cx="30" cy="30" r="26" fill="none" stroke="var(--ink-700)" strokeWidth="5" />
        <circle
          cx="30" cy="30" r="26" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          pathLength={100} strokeDasharray={`${score} 100`}
          className="gauge-arc"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function useCountUp(target: number) {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 450);
      setVal(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

/* ───────────────────────────  icons  ─────────────────────────── */

const I = {
  shield: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" /></svg>
  ),
  flask: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 3h6M10 3v6L5 19a2 2 0 002 2h10a2 2 0 002-2L14 9V3" /></svg>
  ),
  inbox: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13l2.5-8h11L20 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /><path d="M4 13h4l1.5 2.5h5L16 13h4" /></svg>
  ),
  scroll: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 4h11a2 2 0 012 2v12a2 2 0 01-2 2H7M7 4a2 2 0 00-2 2v1h4M7 20a2 2 0 01-2-2v-1h4" /><path d="M11 9h6M11 13h6" /></svg>
  ),
  check: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
  ),
  x: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  play: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5z" /></svg>
  ),
  reset: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 9a8 8 0 112 7" /><path d="M4 4v5h5" /></svg>
  ),
  bolt: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M13 3L5 13h5l-1 8 8-10h-5l1-8z" /></svg>
  ),
  inject: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 3L12 10M14 8l2 2M5 19l-2 2 3 0 0-3M11 13l-6 6 4 0 0-4" /><path d="M15 5l4 4" /></svg>
  ),
  handshake: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l4-5 5 1 5-1 4 5" /><path d="M7 6v8l5 5 5-5V6" /></svg>
  ),
};

/* ───────────────────────────  app shell  ─────────────────────────── */

type Tab = "lab" | "approvals" | "policies" | "audit";

const TABS: { id: Tab; label: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: "lab", label: "Threat Lab", icon: I.flask },
  { id: "approvals", label: "Approvals", icon: I.inbox },
  { id: "policies", label: "Policies", icon: I.shield },
  { id: "audit", label: "Audit Trail", icon: I.scroll },
];

export default function Console() {
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>("lab");
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      setState((await r.json()) as State);
    } catch { /* server restarting */ }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  const ping = useCallback((msg: string, kind = "allow") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const pendingCount = state?.approvals.filter((a) => a.status === "pending").length ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header state={state} pending={pendingCount} />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row">
        <Nav tab={tab} setTab={setTab} pending={pendingCount} />
        <main className="min-w-0 flex-1 pb-10">
          {!state && <Loading />}
          {state && tab === "lab" && <ThreatLab state={state} refresh={refresh} ping={ping} />}
          {state && tab === "approvals" && <Approvals state={state} refresh={refresh} ping={ping} />}
          {state && tab === "policies" && <Policies state={state} refresh={refresh} ping={ping} />}
          {state && tab === "audit" && <AuditView state={state} />}
        </main>
      </div>
      {toast && (
        <div className="anim-slide-in fixed bottom-5 right-5 z-50">
          <div className="surface flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium shadow-2xl" style={{ borderColor: tone(toast.kind).fg }}>
            <span style={{ color: tone(toast.kind).fg }}>{I.check({ size: 14 })}</span>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ state, pending }: { state: State | null; pending: number }) {
  const held = useCountUp(pending);
  const events = useCountUp(state?.audit.length ?? 0);
  return (
    <header className="sticky top-0 z-40 border-b" style={{ background: "color-mix(in srgb, var(--ink-950) 82%, transparent)", backdropFilter: "blur(10px)" }}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl border" style={{ borderColor: "var(--line-strong)", background: "var(--ink-800)" }}>
            <div className="radar-disc absolute inset-0 opacity-40" />
            <span style={{ color: "var(--guardian)" }}>{I.shield({ size: 18 })}</span>
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Agent<span style={{ color: "var(--guardian)" }}>Guardian</span>
            </h1>
            <p className="text-[11px]" style={{ color: "var(--faint)" }}>the safety layer between AI agents and PayPal</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Stat label="awaiting" value={held} hot={pending > 0} />
          <Stat label="events" value={events} />
          <Pill ok={state?.paypalMode === "live"} label={state ? `PayPal · ${state.paypalMode}` : "connecting…"} />
          <Pill ok={state?.llm} label={state ? (state.llm ? "LLM · on" : "LLM · heuristic") : ""} />
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${hot ? "anim-pulse-ring" : ""}`}
      style={{ borderColor: hot ? "var(--amber)" : "var(--line)", background: hot ? "var(--amber-soft)" : "var(--ink-850)" }}
    >
      <span className="font-mono text-base font-bold tabular-nums" style={{ color: hot ? "var(--amber)" : "var(--text)" }}>{value}</span>
      <span className="eyebrow" style={{ color: "var(--faint)" }}>{label}</span>
    </div>
  );
}

function Pill({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
      style={{ borderColor: "var(--line)", color: "var(--muted)", background: "var(--ink-850)" }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "" : "anim-breathe"}`} style={{ background: ok ? "var(--mint)" : "var(--faint)" }} />
      {label}
    </span>
  );
}

function Nav({ tab, setTab, pending }: { tab: Tab; setTab: (t: Tab) => void; pending: number }) {
  return (
    <nav className="flex shrink-0 gap-1.5 overflow-x-auto pb-1 lg:w-48 lg:flex-col lg:overflow-visible lg:pb-0">
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="press relative flex items-center gap-2.5 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-[13px] font-medium"
            style={{
              borderColor: active ? "rgba(77,163,255,.35)" : "transparent",
              background: active ? "var(--guardian-soft)" : "transparent",
              color: active ? "var(--guardian)" : "var(--muted)",
            }}
          >
            {t.icon({ size: 15 })}
            {t.label}
            {t.id === "approvals" && pending > 0 && (
              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[10px] font-bold" style={{ background: "var(--amber)", color: "var(--ink-950)" }}>
                {pending}
              </span>
            )}
          </button>
        );
      })}
      <div className="mt-4 hidden px-3 text-[10px] leading-relaxed lg:block" style={{ color: "var(--faint)" }}>
        Agents connect to Guardian over MCP — never to PayPal directly.
      </div>
    </nav>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => <div key={i} className="shimmer h-24 rounded-xl" />)}
    </div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="eyebrow" style={{ color: "var(--muted)" }}>{children}</h2>
      {right}
    </div>
  );
}

/* ───────────────────────────  Threat Lab  ─────────────────────────── */

const SCENARIOS = [
  {
    kind: "rogue" as const, icon: I.bolt, accent: "var(--coral)", name: "Rogue-agent drain",
    desc: "A compromised shopping agent loops payments to a crypto-mule address after one social-engineered approval. Watch velocity rules catch it.",
  },
  {
    kind: "injection" as const, icon: I.inject, accent: "var(--violet)", name: "Prompt injection",
    desc: "An agent obeys a poisoned email — fake PayPal security notice demanding a $380 gift-card payout, then sneaky retries under the limit.",
  },
  {
    kind: "friendly" as const, icon: I.handshake, accent: "var(--mint)", name: "Friendly flow",
    desc: "A well-behaved freelancer agent: held once for a new client, approved by you, then future invoices flow instantly.",
  },
];

function ThreatLab({ state, refresh, ping }: { state: State; refresh: () => void; ping: (m: string, k?: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ kind: string; steps: ScenarioStep[] } | null>(null);
  const [sim, setSim] = useState({ agentId: "shopping-assistant", tool: "create_payment", recipient: "", amount: "50", note: "" });
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);
  const outRef = useRef<HTMLDivElement>(null);

  const run = async (kind: "rogue" | "injection" | "friendly") => {
    setBusy(kind);
    setResult(null);
    try {
      const res = await fetch("/api/attack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) });
      const j = (await res.json()) as { kind: string; steps: ScenarioStep[] };
      setResult(j);
      const blocked = j.steps.filter((s) => s.output.startsWith("🛑")).length;
      const held = j.steps.filter((s) => s.output.startsWith("⏸")).length;
      ping(`${kind} scenario: ${blocked} blocked, ${held} held`, blocked || held ? "block" : "allow");
      refresh();
    } finally {
      setBusy(null);
      setTimeout(() => outRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  };

  const clearLedger = async () => {
    await fetch("/api/reset", { method: "POST" });
    setResult(null); setSimResult(null);
    ping("Ledger cleared — policies kept", "approval_decided");
    refresh();
  };

  const runSim = async () => {
    const res = await fetch("/api/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sim) });
    setSimResult((await res.json()) as Record<string, unknown>);
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle right={
          <button onClick={clearLedger} className="press flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px]" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
            {I.reset({ size: 13 })} clear ledger
          </button>
        }>
          Threat Lab — one-click attacks through the live engine
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {SCENARIOS.map((s) => (
            <button
              key={s.kind}
              onClick={() => run(s.kind)}
              disabled={busy !== null}
              className="lift press surface group relative overflow-hidden p-4 text-left disabled:opacity-50"
              style={{ borderColor: busy === s.kind ? s.accent : undefined }}
            >
              <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)`, opacity: busy === s.kind ? 1 : 0.35 }} />
              <div className="flex items-center gap-2">
                <span style={{ color: s.accent }}>{s.icon({ size: 17 })}</span>
                <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{s.name}</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--faint)" }}>{s.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: s.accent }}>
                {busy === s.kind ? (<><span className="anim-breathe">running…</span></>) : (<>{I.play({ size: 12 })} run scenario</>)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div ref={outRef} className="anim-fade-up">
          <SectionTitle>Scenario output — {result.kind}</SectionTitle>
          <div className="surface overflow-hidden">
            <div className="flex items-center gap-1.5 border-b px-4 py-2.5" style={{ borderColor: "var(--line)" }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--coral)" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--amber)" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--mint)" }} />
              <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--faint)" }}>guardian://decision-stream</span>
            </div>
            <ol className="divide-y" style={{ borderColor: "var(--line)" }}>
              {result.steps.map((s, i) => (
                <li key={i} className="anim-fade-up p-4" style={{ animationDelay: `${i * 60}ms`, borderColor: "var(--line)" }}>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{s.title}</p>
                  <pre
                    className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg p-3 font-mono text-[11px] leading-relaxed"
                    style={{
                      background: "var(--ink-950)",
                      color: s.output.startsWith("🛑") ? "var(--coral)" : s.output.startsWith("⏸") ? "var(--amber)" : s.output.startsWith("✅") ? "var(--mint)" : "var(--muted)",
                    }}
                  >{s.output}</pre>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div>
        <SectionTitle>Custom probe — dry-run any action (no side effects)</SectionTitle>
        <div className="surface grid gap-2.5 p-4 sm:grid-cols-2">
          <select value={sim.agentId} onChange={(e) => setSim({ ...sim, agentId: e.target.value })} className="rounded-lg border bg-transparent px-3 py-2 font-mono text-xs" style={{ borderColor: "var(--line)", color: "var(--text)" }}>
            {state.agents.map((a) => <option key={a.id} value={a.id} style={{ background: "var(--ink-850)" }}>{a.id}</option>)}
          </select>
          <select value={sim.tool} onChange={(e) => setSim({ ...sim, tool: e.target.value })} className="rounded-lg border bg-transparent px-3 py-2 font-mono text-xs" style={{ borderColor: "var(--line)", color: "var(--text)" }}>
            <option value="create_payment" style={{ background: "var(--ink-850)" }}>agent_pay</option>
            <option value="send_invoice" style={{ background: "var(--ink-850)" }}>send_invoice</option>
            <option value="open_dispute" style={{ background: "var(--ink-850)" }}>open_dispute</option>
            <option value="search_transactions" style={{ background: "var(--ink-850)" }}>search_transactions</option>
          </select>
          <input value={sim.recipient} onChange={(e) => setSim({ ...sim, recipient: e.target.value })} placeholder="recipient@example.com" className="rounded-lg border bg-transparent px-3 py-2 font-mono text-xs placeholder:text-[color:var(--faint)]" style={{ borderColor: "var(--line)", color: "var(--text)" }} />
          <div className="flex gap-2.5">
            <input value={sim.amount} onChange={(e) => setSim({ ...sim, amount: e.target.value })} placeholder="amount" className="w-24 rounded-lg border bg-transparent px-3 py-2 font-mono text-xs placeholder:text-[color:var(--faint)]" style={{ borderColor: "var(--line)", color: "var(--text)" }} />
            <input value={sim.note} onChange={(e) => setSim({ ...sim, note: e.target.value })} placeholder="note — try pressure words" className="flex-1 rounded-lg border bg-transparent px-3 py-2 font-mono text-xs placeholder:text-[color:var(--faint)]" style={{ borderColor: "var(--line)", color: "var(--text)" }} />
          </div>
          <button onClick={runSim} className="press rounded-lg px-4 py-2 text-xs font-bold sm:col-span-2" style={{ background: "var(--guardian)", color: "var(--ink-950)" }}>
            Run decision
          </button>
          {simResult && (
            <div className="anim-fade-up rounded-lg border p-3 sm:col-span-2" style={{ borderColor: tone(String(simResult.outcome)).fg, background: "var(--ink-950)" }}>
              <div className="flex items-center justify-between">
                <Badge kind={String(simResult.outcome)} />
                <RiskGauge score={Number(simResult.riskScore)} size={40} />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>{String(simResult.explanation)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────  Approvals  ─────────────────────────── */

function Approvals({ state, refresh, ping }: { state: State; refresh: () => void; ping: (m: string, k?: string) => void }) {
  const pending = state.approvals.filter((a) => a.status === "pending");
  const history = state.approvals.filter((a) => a.status !== "pending");

  const decide = async (id: string, approve: boolean) => {
    await fetch("/api/approvals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, approve }) });
    ping(approve ? "Approved — Guardian will execute the PayPal call" : "Denied — agent told not to retry", approve ? "approved" : "denied");
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Waiting for you ({pending.length})</SectionTitle>
        {pending.length === 0 ? (
          <EmptyCard
            icon={I.inbox({ size: 22 })}
            title="All quiet"
            body="Nothing is held. Run a scenario in the Threat Lab — the rogue drain and prompt injection both create approval cards you can judge."
          />
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="lift anim-fade-up surface flex gap-4 p-4" style={{ borderColor: "rgba(247,185,85,.3)" }}>
                <RiskGauge score={a.riskScore} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px]" style={{ color: "var(--faint)" }}>{a.id}</span>
                    <Badge kind="pending" />
                    <span className="text-[11px]" style={{ color: "var(--faint)" }}>{fmtTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    <span style={{ color: "var(--guardian)" }}>{a.agentId}</span> wants to {a.toolCall.tool.replace(/_/g, " ")}
                    {a.toolCall.amount && <> <span className="font-mono" style={{ color: "var(--mint)" }}>{a.toolCall.amount.currency_code} {a.toolCall.amount.value}</span></>}
                    {a.toolCall.recipient && <> → <span className="font-mono">{a.toolCall.recipient}</span></>}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>{a.reason}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => decide(a.id, true)} className="press flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold" style={{ background: "var(--mint)", color: "var(--ink-950)" }}>
                      {I.check({ size: 13 })} Approve &amp; execute
                    </button>
                    <button onClick={() => decide(a.id, false)} className="press flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-bold" style={{ borderColor: "var(--coral)", color: "var(--coral)" }}>
                      {I.x({ size: 13 })} Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <SectionTitle>Decided ({history.length})</SectionTitle>
          <div className="surface divide-y">
            {history.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderColor: "var(--line)" }}>
                <Badge kind={a.status} />
                <span className="font-mono text-[11px]" style={{ color: "var(--faint)" }}>{a.id}</span>
                <span className="truncate text-[12px]" style={{ color: "var(--muted)" }}>{a.agentId} · {a.toolCall.tool.replace(/_/g, " ")}{a.toolCall.recipient ? ` → ${a.toolCall.recipient}` : ""}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px]" style={{ color: "var(--faint)" }}>{a.decidedAt ? fmtTime(a.decidedAt) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────  Policies  ─────────────────────────── */

function Policies({ state, refresh, ping }: { state: State; refresh: () => void; ping: (m: string, k?: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    const res = await fetch("/api/policies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nlText: text }) });
    const data = (await res.json()) as { rule?: Rule; error?: string };
    if (data.rule) {
      ping(`Policy enforced: ${data.rule.type}`, "allow");
      setText("");
    } else {
      setErr(data.error ?? "Could not compile that sentence.");
    }
    setBusy(false);
    refresh();
  };

  const toggle = async (id: string, action: "delete" | "toggle") => {
    await fetch("/api/policies", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Write a policy in plain English</SectionTitle>
        <div className="surface p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }}
            rows={2}
            placeholder="e.g. No payment over $300 without me · Block gift-card merchants · Freelance biller gets a $1,000 daily cap"
            className="w-full resize-none rounded-lg border bg-transparent p-3 font-mono text-[12px] placeholder:text-[color:var(--faint)] focus:outline-none"
            style={{ borderColor: "var(--line)", color: "var(--text)" }}
          />
          <div className="mt-2 flex items-center gap-3">
            <button onClick={add} disabled={busy || !text.trim()} className="press rounded-lg px-4 py-2 text-xs font-bold" style={{ background: "var(--guardian)", color: "var(--ink-950)" }}>
              {busy ? "Compiling…" : "Compile & enforce"}
            </button>
            <span className="text-[10px]" style={{ color: "var(--faint)" }}>Ctrl+Enter · works with or without an LLM key</span>
          </div>
          {err && <p className="anim-fade-up mt-2 text-[11px]" style={{ color: "var(--coral)" }}>{err}</p>}
        </div>
      </div>

      <div>
        <SectionTitle>Active policies ({state.policies.length})</SectionTitle>
        <div className="grid gap-2.5 md:grid-cols-2">
          {state.policies.map((p) => (
            <div key={p.id} className="lift surface p-3.5" style={{ opacity: p.enabled ? 1 : 0.45 }}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12.5px] leading-snug" style={{ color: "var(--text)" }}>{p.reason}</p>
                <Badge kind={p.action === "block" ? "block" : "pending"} />
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-[10px]" style={{ color: "var(--faint)" }}>
                <span className="rounded px-1.5 py-0.5" style={{ background: "var(--ink-700)" }}>{p.type}</span>
                <span>{p.agentId === "*" ? "all agents" : p.agentId}</span>
                <span>·</span>
                <span>{p.source.replace("_", " ")}</span>
                <span className="ml-auto flex gap-2">
                  <button onClick={() => toggle(p.id, "toggle")} className="hover:underline" style={{ color: "var(--muted)" }}>{p.enabled ? "pause" : "resume"}</button>
                  <button onClick={() => toggle(p.id, "delete")} className="hover:underline" style={{ color: "var(--coral)" }}>delete</button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Agents under watch</SectionTitle>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {state.agents.map((a) => (
            <div key={a.id} className="lift surface p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>{a.name}</p>
                <Badge kind={a.trustLevel === "high" ? "allow" : a.trustLevel === "medium" ? "pending" : "block"}>{a.trustLevel}</Badge>
              </div>
              <p className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>{a.id}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>{a.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────  Audit  ─────────────────────────── */

const FILTERS = [
  { id: "all", label: "all" },
  { id: "executed", label: "executed" },
  { id: "require_approval", label: "held" },
  { id: "block", label: "blocked" },
  { id: "approval_decided", label: "decisions" },
];

function AuditView({ state }: { state: State }) {
  const [filter, setFilter] = useState("all");
  const rows = useMemo(
    () => (filter === "all" ? state.audit : state.audit.filter((e) => e.outcome === filter)),
    [state.audit, filter],
  );

  return (
    <div>
      <SectionTitle>Audit trail — every decision, with its reason</SectionTitle>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="press rounded-full border px-3 py-1 text-[11px] font-medium"
            style={{
              borderColor: filter === f.id ? "var(--guardian)" : "var(--line)",
              background: filter === f.id ? "var(--guardian-soft)" : "transparent",
              color: filter === f.id ? "var(--guardian)" : "var(--muted)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyCard icon={I.scroll({ size: 22 })} title="No events yet" body="Run a Threat Lab scenario or a terminal demo — every agent action lands here." />
      ) : (
        <ol className="relative ml-2 space-y-3 border-l pl-6" style={{ borderColor: "var(--line)" }}>
          {rows.map((e, i) => (
            <li key={e.id} className="anim-fade-up relative" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
              <span
                className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ring-4"
                style={{ background: tone(e.outcome).fg, boxShadow: "0 0 0 4px var(--ink-950)" }}
              />
              <div className="lift surface p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge kind={e.outcome} />
                  <span className="font-mono text-[11px] font-semibold" style={{ color: "var(--guardian)" }}>{e.agentId}</span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>{e.tool}</span>
                  {e.riskScore > 0 && <span className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>risk {e.riskScore}</span>}
                  <span className="ml-auto font-mono text-[10px]" style={{ color: "var(--faint)" }}>{fmtTime(e.at)}</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>{e.explanation}</p>
                <p className="mt-1 truncate font-mono text-[10px]" style={{ color: "var(--faint)" }}>{e.argsSummary}{e.paypalRef ? ` · ${e.paypalRef}` : ""}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ───────────────────────────  misc  ─────────────────────────── */

function EmptyCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-12 text-center">
      <span style={{ color: "var(--faint)" }}>{icon}</span>
      <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--text)" }}>{title}</p>
      <p className="mt-1 max-w-sm text-[12px] leading-relaxed" style={{ color: "var(--faint)" }}>{body}</p>
    </div>
  );
}
