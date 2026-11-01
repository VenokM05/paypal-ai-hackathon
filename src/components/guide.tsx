"use client";

import type { ReactNode } from "react";
import { tone } from "./console-model";

/* Shared building blocks for the surfaces that teach the console. They exist so
   the tour, the help sheet and the first-run panel all speak one voice instead
   of three near-identical ones. */

/** Numbered instructions. A new visitor needs a next action, not a description. */
export function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="steps">
      {items.map((s, i) => (
        <li key={i}>
          <span className="n">{i + 1}</span>
          <span className="min-w-0">
            <span className="font-semibold text-ink-1">{s.title}</span>
            <span className="block text-ink-3">{s.body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const LEGEND_KEYS = ["block", "require_approval", "executed", "allow"];

/**
 * What red and amber mean, stated once per screen instead of assumed.
 * Same tokens as the chips, so the legend can never drift from the data.
 */
export function ColorLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`legend ${className}`}>
      {LEGEND_KEYS.map((k) => {
        const t = tone(k);
        return (
          <span key={k}>
            <i style={{ background: t.color }} />
            <span
              className="tip"
              data-tip={t.tip}
              tabIndex={0}
            >
              {t.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Inline term with its definition on hover — the lightest possible guide. */
export function Term({ term, children }: { term: string; children: ReactNode }) {
  return (
    <span className="tip" data-tip={term} tabIndex={0}>
      {children}
    </span>
  );
}
