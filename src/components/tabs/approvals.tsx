"use client";

import { fmtAge, fmtTime, money, type Approval, type State } from "@/components/console-model";
import { Icon } from "@/components/icons";
import { Chip, DecisionBar, EmptyState, RiskDial, Section } from "@/components/ui";

type Props = {
  state: State;
  decide: (id: string, approve: boolean) => Promise<void>;
  goLab: () => void;
};

function Request({ a, decide }: { a: Approval; decide: Props["decide"] }) {
  const amount = money(a.toolCall.amount);
  return (
    <li className="anim-fade-up panel flex flex-col gap-3.5 p-3.5 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex items-center gap-3 sm:flex-col sm:items-center">
        <RiskDial score={a.riskScore} />
        <span className="num text-[10px] text-ink-4 sm:hidden">{fmtAge(a.createdAt)} ago</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="num text-[12px] font-semibold text-accent">{a.agentId}</span>
          <span className="text-[12px] text-ink-3">wants to</span>
          <span className="num rounded bg-raised px-1.5 py-0.5 text-[11px] text-ink-1">
            {a.toolCall.tool.replace(/_/g, " ")}
          </span>
          {amount && <span className="num text-[12px] font-semibold text-allow">{amount}</span>}
          {a.toolCall.recipient && (
            <span className="num min-w-0 truncate text-[11.5px] text-ink-2">→ {a.toolCall.recipient}</span>
          )}
          <span className="num ml-auto hidden text-[10px] text-ink-4 sm:block">{fmtAge(a.createdAt)} ago</span>
        </div>

        <p className="mt-2 border-l-2 pl-2.5 text-[12px] leading-relaxed text-ink-2" style={{ borderColor: "var(--hold)" }}>
          {a.reason}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn btn-allow btn-sm" onClick={() => decide(a.id, true)}>
            <Icon.check size={12} /> Approve &amp; execute
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => decide(a.id, false)}>
            <Icon.x size={12} /> Deny
          </button>
          <span className="num text-[10px] text-ink-4">{a.id}</span>
          <span className="text-[10.5px] text-ink-4">approving executes the original call once, against PayPal</span>
        </div>
      </div>
    </li>
  );
}

export function ApprovalsTab({ state, decide, goLab }: Props) {
  const pending = state.approvals.filter((a) => a.status === "pending");
  const decided = state.approvals.filter((a) => a.status !== "pending");
  const executed = decided.filter((a) => a.executed).length;

  return (
    <div className="space-y-7">
      <Section title="Awaiting your decision" meta={`${pending.length} open · ${decided.length} decided`}>
        {pending.length === 0 ? (
          <EmptyState
            icon={<Icon.inbox size={16} />}
            title="Queue is empty"
            body="Nothing is held right now. Run the rogue drain or the prompt-injection scenario — both create approval cards you can judge, and the agent keeps polling until you decide."
            action={
              <button className="btn btn-primary btn-sm" onClick={goLab}>
                <Icon.play size={12} /> Open Threat Lab
              </button>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {pending.map((a) => (
              <Request key={a.id} a={a} decide={decide} />
            ))}
          </ul>
        )}
      </Section>

      {decided.length > 0 && (
        <Section
          title="Decided"
          meta={`${executed} executed · ${decided.length - executed} denied or unexecuted`}
          right={<div className="w-40"><DecisionBar parts={[{ key: "approved", count: executed }, { key: "denied", count: decided.length - executed }]} /></div>}
        >
          <div className="panel overflow-hidden">
            <div className="max-h-[380px] overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>decision</th>
                    <th>agent</th>
                    <th>call</th>
                    <th className="right">risk</th>
                    <th className="right">time</th>
                  </tr>
                </thead>
                <tbody>
                  {decided.slice(0, 25).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Chip kind={a.status} label={a.executed ? "executed" : a.status} />
                      </td>
                      <td className="num nowrap text-accent">{a.agentId}</td>
                      <td className="mono max-w-[280px] truncate">
                        {a.toolCall.tool.replace(/_/g, " ")}
                        {a.toolCall.recipient ? ` → ${a.toolCall.recipient}` : ""}
                        {a.toolCall.amount ? ` · ${money(a.toolCall.amount)}` : ""}
                      </td>
                      <td className="right num">{a.riskScore}</td>
                      <td className="right num text-ink-4">{a.decidedAt ? fmtTime(a.decidedAt) : fmtTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
