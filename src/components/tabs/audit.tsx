"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AUDIT_FILTERS as FILTERS,
  fmtTime,
  matchesFilter as matches,
  tone,
  toolLabel,
  type State,
} from "@/components/console-model";
import { Icon } from "@/components/icons";
import { Chip, DecisionBar, EmptyState, Section } from "@/components/ui";

export function AuditTab({ state, goLab }: { state: State; goLab: () => void }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses the filter box — the habit people bring from every other log UI.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      const typing = t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if (ev.key === "/" && !typing) {
        ev.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.audit.filter(
      (e) =>
        matches(e, filter) &&
        (!q ||
          e.agentId.includes(q) ||
          e.tool.includes(q) ||
          e.argsSummary.toLowerCase().includes(q) ||
          (e.paypalRef ?? "").toLowerCase().includes(q) ||
          e.explanation.toLowerCase().includes(q)),
    );
  }, [state.audit, filter, query]);

  const distribution = useMemo(() => {
    const c = (k: string) => state.audit.filter((e) => e.outcome === k).length;
    return [
      { key: "executed", count: c("executed") },
      { key: "require_approval", count: c("require_approval") },
      { key: "block", count: c("block") },
    ];
  }, [state.audit]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.id, f.id === "all" ? state.audit.length : state.audit.filter((e) => matches(e, f.id)).length]),
      ) as Record<string, number>,
    [state.audit],
  );

  return (
    <div data-tour="ledger">
      <Section
        title="Audit trail"
        meta={`${state.audit.length} requests, newest first · nothing is uploaded`}
        help="Every request an agent made and what Guardian decided. Click a row for the plain-English reason."
        right={<div className="hidden w-48 sm:block"><DecisionBar parts={distribution} /></div>}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              const n = counts[f.id] ?? 0;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  disabled={!n && f.id !== "all"}
                  className="btn btn-sm"
                  style={
                    active
                      ? { background: "var(--accent-wash)", borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)", color: "var(--accent)" }
                      : { background: "transparent", color: "var(--ink-3)", opacity: n ? 1 : 0.4 }
                  }
                >
                  {f.label}
                  <span className="num text-[11px] opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <label className="relative ml-auto w-full max-w-[240px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4">
              <Icon.search size={13} />
            </span>
            <input
              ref={searchRef}
              className="field pl-8"
              placeholder="Search agent, tool or reason"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter audit events"
              title="Try an agent id, a tool name, or a word from the decision reason"
            />
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Icon.grid size={16} />}
            title={state.audit.length ? "No events match" : "Nothing has been decided yet"}
            body={
              state.audit.length
                ? "Widen the filter or clear the search text. Every agent action is recorded, so the events are still there."
                : "This table fills itself. Run an attack in the Threat Lab and each request lands here with the rule that decided it."
            }
            action={
              !state.audit.length ? (
                <button className="btn btn-primary btn-sm" onClick={goLab}>
                  <Icon.play size={12} /> Open Threat Lab
                </button>
              ) : undefined
            }
          />
        ) : (
        <div className="panel overflow-hidden">
          <div className="max-h-[calc(100vh-260px)] overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-[26px]" aria-label="expand" />
                  <th className="w-[74px]">Time</th>
                  <th className="w-[112px] tip" data-tip="Guardian's answer to that one request.">Decision</th>
                  <th className="w-[168px] tip" data-tip="Which AI agent asked. Hover an id in the list to see what it is.">Agent</th>
                  <th className="w-[132px] tip" data-tip="The PayPal tool it tried to call — hover for plain words.">Asked for</th>
                  <th className="tip" data-tip="The amount, recipient or note from the request, as Guardian saw it.">Details</th>
                  <th className="w-[54px] right tip" data-tip="0–100 suspicion for this request. 70 and above reads as red.">Risk</th>
                  <th className="w-[150px] tip" data-tip="Real PayPal sandbox order id, when a payment actually went through.">PayPal id</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const isOpen = open === e.id;
                  return (
                    <Fragment key={e.id}>
                      <tr onClick={() => setOpen(isOpen ? null : e.id)} className="cursor-pointer">
                        <td className="w-[26px] !px-0 !pr-0">
                          <button
                            className="grid h-6 w-6 place-items-center rounded text-ink-4 hover:text-ink-1"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setOpen(isOpen ? null : e.id);
                            }}
                            aria-expanded={isOpen}
                            aria-controls={`event-${e.id}`}
                            aria-label={isOpen ? "Collapse event" : "Expand event"}
                          >
                            <span className="inline-block transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "none" }}>
                              <Icon.chevron size={12} />
                            </span>
                          </button>
                        </td>
                        <td className="num text-ink-4">{fmtTime(e.at)}</td>
                        <td>
                          <Chip kind={e.outcome} />
                        </td>
                        <td className="num nowrap text-accent">{e.agentId}</td>
                        <td className="text-[11px] text-ink-2">
                          <span className="tip tip-bare" data-tip={`The exact tool the agent called: ${e.tool}`} tabIndex={0}>
                            {toolLabel(e.tool)}
                          </span>
                        </td>
                        <td className="mono max-w-[320px] truncate text-[11px]">{e.argsSummary}</td>
                        <td className="right num" style={{ color: e.riskScore >= 70 ? "var(--block)" : e.riskScore >= 40 ? "var(--hold)" : "var(--ink-3)" }}>
                          {e.riskScore || "—"}
                        </td>
                        <td className="mono text-[11px] text-ink-3">{e.paypalRef ?? ""}</td>
                      </tr>
                      {isOpen && (
                        <tr id={`event-${e.id}`}>
                          <td colSpan={8} className="bg-inset !py-3">
                            <p className="max-w-4xl text-[12px] leading-relaxed text-ink-2">{e.explanation}</p>
                            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
                              <span className="num text-ink-4">event {e.id}</span>
                              <span className="text-ink-4">decision: {tone(e.outcome).label}</span>
                              <span className="num text-ink-4">tool {e.tool}</span>
                              <span className="num text-ink-4">args {e.argsSummary}</span>
                              {e.paypalRef && <span className="num text-allow">PayPal id {e.paypalRef}</span>}
                              <span className="num text-ink-4">{new Date(e.at).toLocaleString()}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </Section>
    </div>
  );
}
