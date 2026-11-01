"use client";

import { useState } from "react";
import { RULE_KIND, trustLevel, type State } from "@/components/console-model";
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
      <div data-tour="compose">
        <Section
          title="Write a rule in plain English"
          meta="compiles with or without an LLM key"
          help="Say what you want enforced. Guardian turns the sentence into a machine rule and starts applying it immediately."
        >
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
              <span className="text-[11px] text-ink-4">
                or <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Enter</kbd>
              </span>
              <span className="ml-auto flex flex-wrap gap-1.5">
                <span className="self-center text-[11px] text-ink-4">Try one of these:</span>
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
              <p className="hint mt-2.5">
                With no LLM key the built-in parser accepts these shapes: {EXAMPLES.map((e) => `“${e}”`).join(" · ")}.
                Anything vaguer is refused rather than guessed — a guardrail that misreads a rule is worse than none.
              </p>
            )}
          </div>
        </Section>
      </div>

      <Section
        title="Active rules"
        meta={`${state.policies.length - disabled} enforced · ${disabled} paused`}
        help="Evaluated in order on every request. A paused rule stays written but stops enforcing."
      >
        {state.policies.length === 0 ? (
          <EmptyState icon={<Icon.shield size={16} />} title="No rules yet" body="Guardian still requires a human for first-time recipients, but nothing else is enforced. Write a rule above to start." />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-[128px] tip" data-tip="What kind of limit this is.">Limits</th>
                  <th className="tip" data-tip="The rule in the words it was written in, plus the machine values behind it.">What it says</th>
                  <th className="w-[112px] tip" data-tip="Which agents this applies to. “all” means every agent, now and later.">Applies to</th>
                  <th className="w-[104px] tip" data-tip="What happens when the rule matches: the request is refused, or it waits for a person.">If it matches</th>
                  <th className="w-[132px] right">Change</th>
                </tr>
              </thead>
              <tbody>
                {state.policies.map((p) => {
                  const kind = RULE_KIND[p.type];
                  return (
                    <tr key={p.id} style={{ opacity: p.enabled ? 1 : 0.45 }}>
                      <td>
                        <span className="tip tip-bare text-[11px] text-ink-3" data-tip={kind?.tip ?? `Internal rule type: ${p.type}.`} tabIndex={0}>
                          {kind?.label ?? p.type}
                        </span>
                      </td>
                      <td>
                        <span className="text-ink-1">{p.reason}</span>
                        <span className="num ml-2 text-[11px] text-ink-4">{JSON.stringify(p.params)}</span>
                      </td>
                      <td className="num nowrap text-[11px] text-ink-3">{p.agentId === "*" ? "all agents" : p.agentId}</td>
                      <td>
                        <Chip kind={p.action === "block" ? "block" : "require_approval"} label={p.action === "block" ? "Blocks" : "Holds"} />
                      </td>
                      <td className="right">
                        <span className="inline-flex gap-1.5">
                          <button
                            className="btn btn-quiet btn-sm"
                            onClick={() => patchPolicy(p.id, "toggle")}
                            title={p.enabled ? "Keep the rule but stop enforcing it" : "Start enforcing this rule again"}
                          >
                            {p.enabled ? "pause" : "resume"}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => patchPolicy(p.id, "delete")} title="Delete this rule">
                            <Icon.x size={11} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="The agents"
        meta="what each one is allowed to attempt"
        help="Guardian has met these agents. An agent's trust level scopes what it may try, before any rule is even evaluated."
      >
        <div className="panel divide-y divide-line">
          {state.agents.map((a) => {
            const t = trustLevel(a.trustLevel);
            return (
              <div key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3.5 py-2.5">
                <span className="num text-[12px] font-semibold text-ink-1">{a.id}</span>
                <Chip kind={t.kind} label={t.label} define={false} />
                <span className="tip tip-bare text-[11.5px] text-ink-3" data-tip={t.tip} tabIndex={0}>
                  {a.description}
                </span>
                <span className="num ml-auto text-[11px] text-ink-4">
                  {state.approvals.filter((x) => x.agentId === a.id).length} approval records
                </span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
