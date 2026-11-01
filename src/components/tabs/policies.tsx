"use client";

import { useState } from "react";
import type { State } from "@/components/console-model";
import { Icon } from "@/components/icons";
import { Chip, EmptyState, Section } from "@/components/ui";

/** Every sentence here was verified to compile with no LLM key. */
const EXAMPLES = [
  "No payment over $75 without approval",
  "Max $400 per day",
  "At most 5 payments per minute",
  "Block paypa1-verify.support",
  "Only pay studio-client@example.com",
  "Freelance biller gets a $1,000 daily cap",
];

const TYPE_LABEL: Record<string, string> = {
  amount_limit: "amount",
  daily_total_limit: "daily total",
  velocity_limit: "velocity",
  recipient_allowlist: "allowlist",
  recipient_blocklist: "blocklist",
  new_recipient_approval: "new recipient",
  tool_whitelist: "tool scope",
  approval_required_tools: "tool approval",
};

const trustKind = (t: string) => (t === "high" ? "allow" : t === "medium" ? "pending" : "block");

type Props = {
  state: State;
  addPolicy: (t: string) => Promise<{ rule?: unknown; error?: string }>;
  patchPolicy: (id: string, action: "delete" | "toggle") => Promise<void>;
};

export function PoliciesTab({ state, addPolicy, patchPolicy }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: string) => {
    const t = value.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    const res = await addPolicy(t);
    if (res.rule) setText("");
    else setError(res.error ?? "Could not compile that sentence.");
    setBusy(false);
  };

  const disabled = state.policies.filter((p) => !p.enabled).length;

  return (
    <div className="space-y-7">
      <Section title="Write a rule in plain English" meta="compiles with or without an LLM key">
        <div className="panel p-3.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(text);
            }}
            rows={2}
            aria-label="Policy in plain English"
            className="field resize-none"
            placeholder="No payment over $300 without me"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={() => submit(text)} disabled={busy || !text.trim()}>
              {busy ? "Compiling…" : "Compile & enforce"}
            </button>
            <span className="text-[10.5px] text-ink-4">
              <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Enter</kbd>
            </span>
            <span className="ml-auto flex flex-wrap gap-1.5">
              {EXAMPLES.slice(0, 3).map((x) => (
                <button key={x} className="btn btn-quiet btn-sm" onClick={() => setText(x)}>
                  {x}
                </button>
              ))}
            </span>
          </div>
          {error ? (
            <p className="anim-fade-up mt-2.5 flex items-start gap-2 text-[11.5px]" style={{ color: "var(--block)" }}>
              <span className="mt-0.5 shrink-0"><Icon.alert size={13} /></span>
              <span>{error}</span>
            </p>
          ) : (
            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-4">
              Without a key the deterministic parser accepts these shapes: {EXAMPLES.map((e) => `"${e}"`).join(" · ")}.
              Anything vaguer is refused rather than guessed — a guardrail that misreads a rule is worse than none.
            </p>
          )}
        </div>
      </Section>

      <Section title="Active rules" meta={`${state.policies.length - disabled} enforced · ${disabled} paused`}>
        {state.policies.length === 0 ? (
          <EmptyState icon={<Icon.shield size={16} />} title="No rules" body="Guardian still requires a human for first-time recipients, but nothing else is enforced. Add a rule above." />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-[112px]">type</th>
                  <th>rule</th>
                  <th className="w-[112px]">scope</th>
                  <th className="w-[92px]">action</th>
                  <th className="w-[132px] right">controls</th>
                </tr>
              </thead>
              <tbody>
                {state.policies.map((p) => (
                  <tr key={p.id} style={{ opacity: p.enabled ? 1 : 0.45 }}>
                    <td className="mono text-[11px] text-ink-3">{TYPE_LABEL[p.type] ?? p.type}</td>
                    <td>
                      <span className="text-ink-1">{p.reason}</span>
                      <span className="num ml-2 text-[10.5px] text-ink-4">
                        {JSON.stringify(p.params)}
                      </span>
                    </td>
                    <td className="num nowrap text-[11px] text-ink-3">{p.agentId === "*" ? "all" : p.agentId}</td>
                    <td>
                      <Chip kind={p.action === "block" ? "block" : "require_approval"} label={p.action === "block" ? "block" : "hold"} />
                    </td>
                    <td className="right">
                      <span className="inline-flex gap-1.5">
                        <button className="btn btn-quiet btn-sm" onClick={() => patchPolicy(p.id, "toggle")}>
                          {p.enabled ? "pause" : "resume"}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => patchPolicy(p.id, "delete")}>
                          <Icon.x size={11} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Agents under watch" meta="trust level scopes what each agent may attempt">
        <div className="panel divide-y divide-line">
          {state.agents.map((a) => (
            <div key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3.5 py-2.5">
              <span className="num text-[12px] font-semibold text-ink-1">{a.id}</span>
              <Chip kind={trustKind(a.trustLevel)} label={a.trustLevel} />
              <span className="text-[11.5px] text-ink-3">{a.description}</span>
              <span className="num ml-auto text-[10.5px] text-ink-4">
                {state.approvals.filter((x) => x.agentId === a.id).length} approval records
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
