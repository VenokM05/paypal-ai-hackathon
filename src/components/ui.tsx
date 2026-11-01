"use client";

import type { ReactNode } from "react";
import { riskTone, tone, type Tone } from "./console-model";
import { Icon } from "./icons";

/* ─────────────────────────  section frame  ───────────────────────── */

export function Section({
  title,
  meta,
  right,
  children,
  className = "",
}: {
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <header className="mb-2.5 flex items-baseline gap-3">
        <h2 className="eyebrow shrink-0">{title}</h2>
        {/* min-w-0 is what makes the truncate real: without it this text
            sets a floor and pushes the whole page wider than the viewport. */}
        {meta && <span className="num min-w-0 flex-1 truncate text-[10px] text-ink-4">{meta}</span>}
        <span className="ml-auto shrink-0">{right}</span>
      </header>
      {children}
    </section>
  );
}

/* ─────────────────────────  status chip  ───────────────────────── */

export function Chip({
  kind,
  label,
  mono = true,
  className = "",
}: {
  kind: string;
  label?: string;
  mono?: boolean;
  className?: string;
}) {
  const t = tone(kind);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] ${
        mono ? "num" : ""
      } ${className}`}
      style={{ color: t.color, background: t.wash, boxShadow: `inset 0 0 0 1px ${hex(t.color, 0.28)}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
      {label ?? t.label}
    </span>
  );
}

/** Keeps the palette in CSS variables while allowing an alpha channel. */
function hex(colorVar: string, alpha: number) {
  // color-mix is supported by every current browser; it lets a var() token take opacity
  return `color-mix(in srgb, ${colorVar} ${Math.round(alpha * 100)}%, transparent)`;
}

export function NeutralChip({ children }: { children: ReactNode }) {
  return (
    <span className="num inline-flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 text-[10px] text-ink-3">
      {children}
    </span>
  );
}

/* ─────────────────────────  risk dial  ───────────────────────── */

/**
 * Score as geometry. The dial is 3/4 of a circle so the open gap reads as
 * "room left", and the number stays the primary signal (colour-blind safe).
 */
export function RiskDial({ score, size = 46 }: { score: number; size?: number }) {
  const t = riskTone(score);
  const r = 15.915; // circumference 100 at r=15.915, so dasharray == percent
  const arc = 75; // 3/4 turn
  const shown = Math.max(0, Math.min(100, score));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle
          cx="20" cy="20" r={r} fill="none" stroke="var(--raised)" strokeWidth="3"
          strokeDasharray={`${arc} 100`} strokeLinecap="round"
        />
        <circle
          className="gauge-arc" cx="20" cy="20" r={r} fill="none" stroke={t.color} strokeWidth="3"
          strokeDasharray={`${(shown / 100) * arc} 100`} strokeLinecap="round"
          pathLength={100}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="num text-[13px] font-bold leading-none" style={{ color: t.color }}>
          {shown}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────  distribution bar  ───────────────────────── */

export function DecisionBar({
  parts,
}: {
  parts: { key: string; count: number }[];
}) {
  const total = parts.reduce((n, p) => n + p.count, 0);
  if (!total) return <div className="h-1.5 rounded-sm bg-raised" />;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-sm bg-raised" role="img" aria-label={parts.map((p) => `${p.count} ${p.key}`).join(", ")}>
      {parts.map((p) =>
        p.count ? (
          <div
            key={p.key}
            className="bar-grow"
            style={{ width: `${(p.count / total) * 100}%`, background: tone(p.key).color }}
          />
        ) : null,
      )}
    </div>
  );
}

/* ─────────────────────────  empty + loading  ───────────────────────── */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-start gap-3 px-5 py-7 sm:flex-row sm:items-center">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-raised text-ink-3">{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink-1">{title}</p>
        <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-ink-3">{body}</p>
      </div>
      {action && <div className="sm:ml-auto">{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="panel divide-y divide-line p-0" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <span className="anim-breathe h-6 w-6 rounded-full bg-raised" />
          <span className="anim-breathe h-2.5 flex-1 rounded bg-raised" style={{ maxWidth: `${180 + i * 60}px` }} />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────  toast  ───────────────────────── */

export function Toaster({ msg, kind }: { msg: string; kind: string }) {
  const t: Tone = tone(kind);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 sm:justify-end sm:pr-6" role="status" aria-live="polite">
      <div
        className="anim-slide-in panel flex max-w-[92vw] items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-ink-1"
        style={{ borderColor: hex(t.color, 0.4) }}
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: t.wash, color: t.color }}>
          {t.color === "var(--block)" ? <Icon.x size={12} /> : <Icon.check size={12} />}
        </span>
        {msg}
      </div>
    </div>
  );
}
