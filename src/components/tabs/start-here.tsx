"use client";

import { Icon } from "@/components/icons";
import { ColorLegend, Steps } from "@/components/guide";

/**
 * Shown only while the ledger is empty, i.e. before anything has happened on
 * this machine. It answers the three questions a first visitor actually has —
 * what is this, what do I press, what will I see — and then gets out of the way.
 */
export function StartHere({ onTour, onRun }: { onTour: () => void; onRun: () => void }) {
  return (
    <section className="panel anim-fade-up overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
        <span
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded"
          style={{ background: "var(--accent-wash)", color: "var(--accent)" }}
        >
          <Icon.book size={15} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink-1">New here? Start with this</h2>
          <p className="hint mt-1">
            An AI agent can already move money through PayPal. <strong className="font-semibold text-ink-2">Agent
            Guardian stands in front of it</strong>: your rules decide, a risk model scores each request, a human
            approves the risky ones, and every decision is written down. The empty table below is what the trail
            looks like before anything has been asked.
          </p>
        </div>
      </div>

      <div className="grid gap-5 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Steps
          items={[
            {
              title: "Run an attack",
              body: (
                <>
                  Press <strong className="font-semibold text-ink-1">Run</strong> on “Rogue-agent drain” below. Ten
                  real requests go through the engine — the same path a live agent takes.
                </>
              ),
            },
            {
              title: "Read the trace",
              body: "Each row is one request and one verdict. Watch which rules fire, and what the agent is told in reply.",
            },
            {
              title: "Then decide",
              body: "Anything held waits in Approvals. Nothing reaches PayPal until a person says yes.",
            },
          ]}
        />
        <div className="space-y-3">
          <div>
            <h3 className="eyebrow mb-1.5">What the colours mean</h3>
            <ColorLegend className="flex-col !gap-1.5" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm" onClick={onRun}>
              <Icon.play size={12} /> Run the first attack
            </button>
            <button className="btn btn-quiet btn-sm" onClick={onTour}>
              <Icon.help size={12} /> Show me around
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
