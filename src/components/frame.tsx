"use client";

import type { State } from "./console-model";
import { Icon } from "./icons";

/**
 * Product chrome that isn't navigation: the wordmark, the status strip along
 * the top, and the ledger readout pinned to the bottom.
 */
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded"
        style={{
          background: "var(--accent-wash)",
          color: "var(--accent)",
          boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)",
        }}
      >
        <Icon.shield size={15} />
      </span>
      {!small && (
        <span className="min-w-0">
          <span className="block text-[13px] font-bold leading-none tracking-tight text-ink-1">Agent Guardian</span>
          <span className="mt-1 block truncate text-[10px] leading-none text-ink-4">payment guardrails for agents</span>
        </span>
      )}
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em]"
      style={{ color: ok ? "var(--allow)" : "var(--ink-3)" }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "" : "anim-breathe"}`} style={{ background: ok ? "var(--allow)" : "var(--ink-4)" }} />
      {label}
    </span>
  );
}

export function TopBar({ state, pending, title }: { state: State | null; pending: number; title: string }) {
  const live = state?.paypalMode === "live";
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-4 border-b border-line bg-canvas/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-2.5 md:hidden">
        <Brand small />
      </div>
      <h1 className="hidden text-[13px] font-semibold text-ink-1 md:block">{title}</h1>

      <div className="ml-auto flex items-center gap-4">
        {pending > 0 && (
          <span
            className="num inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold"
            style={{ background: "var(--hold-wash)", color: "var(--hold)" }}
          >
            <Icon.clock size={12} />
            {pending} awaiting
          </span>
        )}
        <span className="hidden items-center gap-4 sm:flex">
          <StatusDot ok={!!live} label={state ? `paypal ${state.paypalMode}` : "connecting"} />
          <StatusDot ok={!!state?.llm} label={state ? (state.llm ? "llm" : "heuristic") : ""} />
        </span>
      </div>
    </header>
  );
}

export function StatusBar({ state }: { state: State | null }) {
  const cells: [string, string][] = state
    ? [
        ["engine", `${state.policies.filter((p) => p.enabled).length}/${state.policies.length} rules`],
        ["agents", String(state.agents.length)],
        ["events", String(state.audit.length)],
        ["ledger", "sqlite · local"],
        ["transport", "mcp stdio"],
      ]
    : [["status", "loading"]];
  return (
    <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-canvas/95 px-4 py-1.5 backdrop-blur-sm sm:px-6">
      {cells.map(([k, v]) => (
        <span key={k} className="text-[10.5px]">
          <span className="uppercase tracking-[0.08em] text-ink-4">{k}</span> <span className="num text-ink-3">{v}</span>
        </span>
      ))}
      <span className="ml-auto hidden items-center gap-1.5 text-[10.5px] text-ink-4 lg:flex">
        <kbd className="kbd">1</kbd>
        <span>–</span>
        <kbd className="kbd">4</kbd>
        <span>sections</span>
      </span>
    </footer>
  );
}
