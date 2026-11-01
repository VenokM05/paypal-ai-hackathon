"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TabId } from "./console-model";
import { Icon } from "./icons";

/** Set in localStorage once the tour finishes, so it never nags a second time. */
export const TOUR_KEY = "guardian.tour.v1";

type Step = { anchor: string; tab: TabId; title: string; body: string };

/**
 * Six stops, in the order a person actually needs them: what is this, what is
 * the loop, press this to see it work, then the three places you would go next.
 * `anchor` matches a data-tour attribute; `tab` is switched before measuring.
 */
export const TOUR_STEPS: Step[] = [
  {
    anchor: "rail",
    tab: "lab",
    title: "Four sections, one loop",
    body: "Threat Lab runs attacks so you can watch the guardrail work. Approvals is where you decide. Policies is the rulebook. Audit is the receipt trail. Keys 1–4 jump between them.",
  },
  {
    anchor: "path",
    tab: "lab",
    title: "Every payment crosses these five stops",
    body: "The agent asks, the policy engine checks your rules, the risk model scores it, a human can be pulled in, and only then does anything reach PayPal. Rules have the final word — the AI can add suspicion, never loosen a rule.",
  },
  {
    anchor: "attacks",
    tab: "lab",
    title: "Start here",
    body: "Press Run on any row. Each step is a real tool call through the same engine a live agent uses, so the verdicts you see are the ones that agent would get. Nothing here is canned for the camera.",
  },
  {
    anchor: "compose",
    tab: "policies",
    title: "Write a rule in plain English",
    body: "Try “No payment over $75 without approval”. Guardian compiles that sentence into a machine rule you can pause or delete — with or without an LLM key configured.",
  },
  {
    anchor: "queue",
    tab: "approvals",
    title: "You are the backstop",
    body: "Anything that trips a rule waits here instead of reaching PayPal. Approve and Guardian makes the original call exactly once. Deny and the agent is told to stop.",
  },
  {
    anchor: "ledger",
    tab: "audit",
    title: "Every decision is a row",
    body: "Red blocked it, amber is waiting on you, green moved. Click any row for the plain-English reason, the rules that fired, and the PayPal reference. That trail is why this is auditable after the fact.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;
const GAP = 12;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(lo, v), Math.max(lo, hi));

/**
 * Once the tour has been dismissed — finished, skipped, or escaped — it stays
 * dismissed. Re-showing it on every reload would make the first-run panel the
 * thing people learn to close without reading.
 */
export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_KEY, "done");
  } catch {
    /* private mode: the tour just replays next visit */
  }
}

export function Tour({
  index,
  setIndex,
  onClose,
  setTab,
}: {
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
  setTab: (t: TabId) => void;
}) {
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;
  const card = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  /** Re-measure the target. Returns false when the tab has not rendered it yet. */
  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });

    // Put the card where it does not cover what it is pointing at: beside tall
    // things (the rail), below wide things (a strip), above things near the fold.
    const ch = card.current?.offsetHeight ?? 190;
    const cw = card.current?.offsetWidth ?? 340;
    const { innerWidth: vw, innerHeight: vh } = window;
    const xBelow = Math.min(Math.max(GAP, r.left), Math.max(GAP, vw - cw - GAP));
    const tall = r.height > vh * 0.55;
    const beside = r.right + GAP + cw <= vw ? r.right + GAP : r.left - GAP - cw;
    if (tall && beside > GAP) setPos({ top: clamp(r.top + 24, GAP, vh - ch - GAP), left: beside });
    else if (r.bottom + GAP + ch <= vh) setPos({ top: r.bottom + GAP, left: xBelow });
    else if (r.top - GAP - ch >= GAP) setPos({ top: r.top - ch - GAP, left: xBelow });
    else if (beside > GAP) setPos({ top: clamp(r.top + 24, GAP, vh - ch - GAP), left: beside });
    else setPos({ top: clamp(r.top + GAP, GAP, Math.max(GAP, vh - ch - GAP)), left: xBelow });
    return true;
  }, [step.anchor]);

  useEffect(() => {
    setTab(step.tab);
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });

    // The panel mounts a frame later than this effect, so poll for the anchor
    // instead of measuring a node that does not exist yet.
    let tries = 0;
    let raf = 0;
    const hunt = () => {
      if (measure() || ++tries > 30) return;
      raf = requestAnimationFrame(hunt);
    };
    raf = requestAnimationFrame(hunt);

    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [measure, setTab, step.anchor, step.tab]);

  const advance = useCallback(
    (forward: boolean) => {
      if (forward) {
        if (last) onClose();
        else setIndex(index + 1);
      } else if (index > 0) setIndex(index - 1);
    },
    [index, last, onClose, setIndex],
  );

  // Esc always exits; arrows move while the card itself holds focus.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
      else if (ev.key === "ArrowRight") advance(true);
      else if (ev.key === "ArrowLeft") advance(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, onClose]);

  useEffect(() => card.current?.querySelector<HTMLElement>(".btn-primary")?.focus(), [index]);

  return (
    <>
      {rect && (
        <div
          className="spot"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden="true"
        />
      )}
      <div ref={card} className="coach" role="dialog" aria-label="Guided tour" style={{ top: pos.top, left: pos.left }}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-ink-1">{step.title}</h3>
          <span className="num text-[11px] text-ink-4">
            {index + 1}/{TOUR_STEPS.length}
          </span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-2">{step.body}</p>

        <div className="mt-3.5 flex items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => advance(true)}>
            {last ? (
              <>
                <Icon.check size={12} /> Finish
              </>
            ) : (
              <>
                Next <Icon.chevron size={12} />
              </>
            )}
          </button>
          {index > 0 && (
            <button className="btn btn-quiet btn-sm" onClick={() => advance(false)}>
              Back
            </button>
          )}
          <button className="btn btn-quiet btn-sm ml-auto" onClick={onClose}>
            Skip
          </button>
          <span className="coach-dots ml-1" aria-hidden="true">
            {TOUR_STEPS.map((s, i) => (
              <i key={s.anchor} aria-current={i === index} />
            ))}
          </span>
        </div>
      </div>
    </>
  );
}
