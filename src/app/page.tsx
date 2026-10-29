"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

const OUTCOME_STYLE: Record<string, string> = {
  allow: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  executed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  block: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  require_approval: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approval_decided: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  denied: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

function Chip({ value, children }: { value: string; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${OUTCOME_STYLE[value] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30"}`}>
      {children ?? value.replace("_", " ")}
    </span>
  );
}

function RiskMeter({ score }: { score: number }) {
  const color = score >= 70 ? "bg-rose-400" : score >= 40 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-800">
        <span className={`block h-full ${color}`} style={{ width: `${score}%` }} />
      </span>
      {score}
    </span>
  );
}

export default function Dashboard() {
  const [state, setState] = useState<State | null>(null);
  const [policyText, setPolicyText] = useState("");
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyMsg, setPolicyMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [sim, setSim] = useState({ agentId: "shopping-assistant", tool: "create_payment", recipient: "", amount: "50", note: "" });
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);

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

  const addPolicy = async () => {
    if (!policyText.trim()) return;
    setPolicyBusy(true);
    setPolicyMsg(null);
    const res = await fetch("/api/policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nlText: policyText }),
    });
    const data = (await res.json()) as { rule?: Rule; error?: string };
    if (data.rule) {
      setPolicyMsg({ kind: "ok", text: `Compiled → ${data.rule.type} (${data.rule.action})` });
      setPolicyText("");
    } else {
      setPolicyMsg({ kind: "err", text: data.error ?? "Could not compile that sentence." });
    }
    setPolicyBusy(false);
    refresh();
  };

  const toggleRule = async (id: string, action: "delete" | "toggle") => {
    await fetch("/api/policies", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    refresh();
  };

  const decide = async (id: string, approve: boolean) => {
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, approve }),
    });
    refresh();
  };

  const runSim = async () => {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sim),
    });
    setSimResult((await res.json()) as Record<string, unknown>);
  };

  const pending = useMemo(() => state?.approvals.filter((a) => a.status === "pending") ?? [], [state]);
  const blockedToday = useMemo(
    () => state?.audit.filter((e) => e.outcome === "block" || e.outcome === "require_approval").length ?? 0,
    [state],
  );

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <p className="animate-pulse font-mono text-sm">connecting to Guardian…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      {/* header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 font-mono text-emerald-300">G</div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-slate-100">AGENT GUARDIAN</h1>
              <p className="text-[11px] text-slate-500">the safety layer between AI agents and PayPal</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-5 font-mono text-[11px]">
            <span className={pending.length ? "text-amber-300" : "text-slate-500"}>
              {pending.length} awaiting approval
            </span>
            <span className="text-slate-500">{blockedToday} held/blocked</span>
            <span className="text-slate-500">{state.audit.length} events</span>
            <span className={`rounded border px-1.5 py-0.5 ${state.paypalMode === "live" ? "border-emerald-500/40 text-emerald-300" : "border-sky-500/40 text-sky-300"}`}>
              PAYPAL {state.paypalMode.toUpperCase()}
            </span>
            <span className={`rounded border px-1.5 py-0.5 ${state.llm ? "border-emerald-500/40 text-emerald-300" : "border-slate-600 text-slate-400"}`}>
              LLM {state.llm ? "ON" : "HEURISTIC"}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-3">
        {/* left column: policies */}
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">New policy — plain English</h2>
            <textarea
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              rows={3}
              placeholder={'e.g. "Never let any agent send more than $300 in a single payment" or "Block payments to gift-card merchants"'}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
            />
            <button
              onClick={addPolicy}
              disabled={policyBusy || !policyText.trim()}
              className="mt-2 w-full rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
            >
              {policyBusy ? "Compiling…" : "Compile & enforce"}
            </button>
            {policyMsg && (
              <p className={`mt-2 text-[11px] ${policyMsg.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{policyMsg.text}</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Active policies ({state.policies.length})</h2>
            <ul className="space-y-2">
              {state.policies.map((p) => (
                <li key={p.id} className={`rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs ${p.enabled ? "" : "opacity-40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="leading-snug text-slate-200">{p.reason}</p>
                    <Chip value={p.action} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-slate-500">
                    <span>{p.type}</span>
                    <span>·</span>
                    <span>{p.agentId === "*" ? "all agents" : p.agentId}</span>
                    <span>·</span>
                    <span>{p.source.replace("_", " ")}</span>
                    <span className="ml-auto flex gap-2">
                      <button onClick={() => toggleRule(p.id, "toggle")} className="text-slate-400 hover:text-slate-100">{p.enabled ? "pause" : "resume"}</button>
                      <button onClick={() => toggleRule(p.id, "delete")} className="text-rose-400/70 hover:text-rose-300">del</button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Registered agents</h2>
            <ul className="space-y-2 text-xs">
              {state.agents.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-200">{a.name}</p>
                    <p className="font-mono text-[10px] text-slate-500">{a.id}</p>
                  </div>
                  <Chip value={a.trustLevel === "low" ? "block" : a.trustLevel === "high" ? "allow" : "pending"} children={a.trustLevel} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* middle: approvals */}
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Approval queue {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-300">{pending.length}</span>}
            </h2>
            {pending.length === 0 && (
              <p className="py-8 text-center font-mono text-xs text-slate-600">nothing waiting — run a demo script to generate a hold</p>
            )}
            <ul className="space-y-3">
              {pending.map((a) => (
                <li key={a.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] text-amber-300">{a.id}</p>
                    <RiskMeter score={a.riskScore} />
                  </div>
                  <p className="mt-2 leading-snug text-slate-200">
                    <span className="font-semibold">{a.agentId}</span> wants to{" "}
                    <span className="font-mono">{a.toolCall.tool.replace("_", " ")}</span>
                    {a.toolCall.amount && <> <span className="font-mono text-emerald-300">{a.toolCall.amount.currency_code} {a.toolCall.amount.value}</span></>}
                    {a.toolCall.recipient && <> → <span className="font-mono">{a.toolCall.recipient}</span></>}
                  </p>
                  <p className="mt-1.5 leading-snug text-slate-400">{a.reason}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => decide(a.id, true)} className="flex-1 rounded-lg bg-emerald-500/90 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400">Approve & execute</button>
                    <button onClick={() => decide(a.id, false)} className="flex-1 rounded-lg border border-rose-500/40 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/10">Deny</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* simulator */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Simulate an agent action</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select value={sim.agentId} onChange={(e) => setSim({ ...sim, agentId: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[11px]">
                {state.agents.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
              </select>
              <select value={sim.tool} onChange={(e) => setSim({ ...sim, tool: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[11px]">
                <option value="create_payment">agent_pay</option>
                <option value="send_invoice">send_invoice</option>
                <option value="open_dispute">open_dispute</option>
                <option value="search_transactions">search_transactions</option>
              </select>
              <input value={sim.recipient} onChange={(e) => setSim({ ...sim, recipient: e.target.value })} placeholder="recipient@example.com" className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[11px] placeholder:text-slate-600" />
              <input value={sim.amount} onChange={(e) => setSim({ ...sim, amount: e.target.value })} placeholder="amount" className="rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[11px] placeholder:text-slate-600" />
              <input value={sim.note} onChange={(e) => setSim({ ...sim, note: e.target.value })} placeholder="note (pressure words?)" className="rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[11px] placeholder:text-slate-600" />
              <button onClick={runSim} className="col-span-2 rounded-lg bg-sky-500/80 py-2 text-[11px] font-semibold text-slate-950 hover:bg-sky-400">Run decision (dry-run, no side effects)</button>
            </div>
            {simResult && (
              <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <Chip value={String(simResult.outcome)} />
                  <RiskMeter score={Number(simResult.riskScore)} />
                </div>
                <p className="mt-2 leading-snug text-slate-300">{String(simResult.explanation)}</p>
                {Array.isArray(simResult.riskFactors) && (simResult.riskFactors as string[]).length > 0 && (
                  <p className="mt-1 font-mono text-[10px] text-slate-500">factors: {(simResult.riskFactors as string[]).join(" · ")}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* right: audit feed */}
        <section>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Audit trail</h2>
            <ul className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
              {state.audit.length === 0 && (
                <li className="py-8 text-center font-mono text-xs text-slate-600">empty — run <code>npm run demo:rogue</code></li>
              )}
              {state.audit.map((e) => (
                <li key={e.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Chip value={e.outcome} />
                    <span className="font-mono text-[10px] text-slate-200">{e.agentId}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-500">{new Date(e.at).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1.5 leading-snug text-slate-400">{e.explanation}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-600">{e.tool} {e.argsSummary}{e.paypalRef ? ` · ${e.paypalRef}` : ""}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
