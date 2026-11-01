"use client";

import type { ReactNode } from "react";
import type { TabId } from "./console-model";
import { Icon } from "./icons";
import { Brand } from "./frame";

export const NAV: { id: TabId; label: string; hint: string; icon: (p: { size?: number }) => ReactNode }[] = [
  { id: "lab", label: "Threat Lab", hint: "Run a scripted attack and watch the guardrail answer it.", icon: Icon.flask },
  { id: "approvals", label: "Approvals", hint: "Payments waiting for a person. None of these reached PayPal.", icon: Icon.inbox },
  { id: "policies", label: "Policies", hint: "The limits an agent must respect — written in plain English.", icon: Icon.shield },
  { id: "audit", label: "Audit Trail", hint: "Every request, its decision, and the reason for it.", icon: Icon.grid },
];

function RailContent({
  tab,
  setTab,
  counts,
  onHelp,
}: {
  tab: TabId;
  setTab: (t: TabId) => void;
  counts: Record<TabId, number>;
  onHelp: () => void;
}) {
  return (
    <>
      <div className="px-4 py-4">
        <Brand />
      </div>

      <nav aria-label="Console sections" className="px-2">
        <ul role="tablist" aria-orientation="vertical" className="space-y-0.5">
          {NAV.map((n, i) => {
            const active = tab === n.id;
            return (
              <li key={n.id}>
                <button
                  role="tab"
                  id={`tab-${n.id}`}
                  aria-selected={active}
                  aria-controls="panel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(n.id)}
                  className="group relative flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-[12.5px] transition-colors"
                  style={{
                    background: active ? "var(--raised)" : "transparent",
                    color: active ? "var(--ink-1)" : "var(--ink-3)",
                  }}
                >
                  {/* active marker sits in the gutter so labels stay aligned */}
                  <span
                    className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full transition-opacity"
                    style={{ background: "var(--accent)", opacity: active ? 1 : 0 }}
                  />
                  <span style={{ color: active ? "var(--accent)" : "var(--ink-4)" }}>{n.icon({ size: 15 })}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {/* the section's own definition, on hover, where the label is */}
                    <span className="tip tip-bare block" data-tip={n.hint}>
                      {n.label}
                    </span>
                  </span>
                  {counts[n.id] > 0 && (
                    <span
                      className="num rounded px-1 text-[10px] font-semibold"
                      style={
                        n.id === "approvals"
                          ? { background: "var(--hold-wash)", color: "var(--hold)" }
                          : { color: "var(--ink-4)" }
                      }
                    >
                      {counts[n.id]}
                    </span>
                  )}
                  <kbd className="kbd ml-0.5 hidden opacity-0 transition-opacity group-hover:opacity-100 md:inline">{i + 1}</kbd>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-2.5 border-t border-line px-4 py-3.5">
        <button className="btn btn-quiet btn-sm w-full" onClick={onHelp}>
          <Icon.help size={12} /> How this works
        </button>
        <p className="text-[11px] leading-relaxed text-ink-4">
          Agents reach PayPal through this MCP server only. There is no path from an agent to the payment
          API that skips a decision.
        </p>
      </div>
    </>
  );
}

export function Rail({
  tab,
  setTab,
  counts,
  onHelp,
}: {
  tab: TabId;
  setTab: (t: TabId) => void;
  counts: Record<TabId, number>;
  onHelp: () => void;
}) {
  return (
    <aside
      data-tour="rail"
      className="fixed inset-y-0 left-0 z-30 hidden w-[216px] flex-col border-r border-line bg-canvas md:flex"
    >
      <RailContent tab={tab} setTab={setTab} counts={counts} onHelp={onHelp} />
    </aside>
  );
}

/** Narrow screens fold the rail into a scrollable strip above the content. */
export function MobileTabs({
  tab,
  setTab,
  counts,
  onHelp,
}: {
  tab: TabId;
  setTab: (t: TabId) => void;
  counts: Record<TabId, number>;
  onHelp: () => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
      {NAV.map((n) => {
        const active = tab === n.id;
        return (
          <button
            key={n.id}
            title={n.hint}
            onClick={() => setTab(n.id)}
            className="flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-medium"
            style={{ background: active ? "var(--raised)" : "transparent", color: active ? "var(--ink-1)" : "var(--ink-3)" }}
          >
            {n.icon({ size: 14 })}
            {n.label}
            {counts[n.id] > 0 && <span className="num text-[11px]" style={{ color: "var(--hold)" }}>{counts[n.id]}</span>}
          </button>
        );
      })}
      <button className="btn btn-quiet btn-sm ml-auto shrink-0" onClick={onHelp} aria-label="How this works">
        <Icon.help size={12} />
      </button>
    </div>
  );
}
