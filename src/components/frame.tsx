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

function StatusDot({ ok, label, tip }: { ok: boolean; label: string; tip: string }) {
  return (
    <span
      className="tip tip-bare inline-flex items-center gap-1.5 text-[11px]"
      data-tip={tip}
      tabIndex={0}
      style={{ color: ok ? "var(--allow)" : "var(--ink-3)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ok ? "var(--allow)" : "var(--ink-4)" }} />
      {label}
    </span>
  );
}

export function TopBar({
  state,
  pending,
  title,
  onHelp,
}: {
  state: State | null;
  pending: number;
  title: string;
  onHelp: () => void;
}) {
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
            {pending} waiting for you
          </span>
        )}
        <span className="hidden items-center gap-4 sm:flex">
          <StatusDot
            ok={!!live}
            label={state ? (live ? "PayPal sandbox" : "PayPal mock") : "connecting"}
            tip={
              live
                ? "Guardian is calling the real PayPal sandbox API. Approved payments create live order ids."
                : "Mock mode: PayPal-shaped responses, no account or key needed. Same rules, same decisions."
            }
          />
          <StatusDot
            ok={!!state?.llm}
            label={state ? (state.llm ? "LLM risk model" : "Heuristic risk model") : ""}
            tip={
              state?.llm
                ? "A language model is reading each request for scam and injection language. It can only add suspicion."
                : "No LLM key, so deterministic patterns are scoring risk. Rules are unaffected either way."
            }
          />
        </span>
        <button className="btn btn-quiet btn-sm" onClick={onHelp}>
          <Icon.help size={12} />
          <span className="hidden sm:inline">How this works</span>
        </button>
      </div>
    </header>
  );
}

export function StatusBar({ state }: { state: State | null }) {
  const mode = state?.ledger === "memory" || state?.ledger === "ephemeral" ? state.ledger : "local";
  const ledgerLabel =
    mode === "memory" ? "SQLite (memory)" : mode === "ephemeral" ? "SQLite (this instance)" : "local SQLite";
  const ledgerTip =
    mode === "memory"
      ? "No writable disk here, so the ledger opens in memory: full engine, but history ends with the request."
      : mode === "ephemeral"
        ? "This host's disk is read-only, so the ledger sits in its temp folder. Every rule, approval and audit row is real — but each serverless instance keeps its own history, and a cold start re-seeds. Run it locally for a durable trail."
        : "The audit file lives at ./data/guardian.db. Gitignored, never uploaded.";
  const cells: [string, string, string][] = state
    ? [
        ["Rules", `${state.policies.filter((p) => p.enabled).length}/${state.policies.length} active`, "Limits an agent may not cross. Disabled rules are counted but not enforced."],
        ["Agents", String(state.agents.length), "AI agents Guardian has seen. Each one has a trust level that scopes what it may attempt."],
        ["Requests", String(state.audit.length), "Decisions recorded on this machine since the ledger was last cleared."],
        ["Ledger", ledgerLabel, ledgerTip],
        ["Agent link", "MCP", "Model Context Protocol over stdio — the only way an agent reaches PayPal here."],
      ]
    : [["Status", "loading", "Reading the local ledger."]];
  return (
    <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-canvas/95 px-4 py-1.5 backdrop-blur-sm sm:px-6">
      {cells.map(([k, v, tip]) => (
        <span key={k} className="text-[11px]">
          <span className="tip tip-bare text-ink-4" data-tip={tip} tabIndex={0}>
            {k}
          </span>{" "}
          <span className="num text-ink-3">{v}</span>
        </span>
      ))}
      <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-ink-4 lg:flex">
        <kbd className="kbd">1</kbd>
        <span>–</span>
        <kbd className="kbd">4</kbd>
        <span>sections</span>
        <kbd className="kbd">?</kbd>
        <span>help</span>
      </span>
    </footer>
  );
}
