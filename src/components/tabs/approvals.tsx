"use client";

import { fmtAge, fmtTime, money, riskTone, toolLabel, type Approval, type State } from "@/components/console-model";
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
        <span className="tip tip-bare" data-tip="0–100 suspicion for this one request. 70 or more is why it stopped here." tabIndex={0}>
          <RiskDial score={a.riskScore} />
        </span>
        <span className="num text-[11px] text-ink-4 sm:hidden">{fmtAge(a.createdAt)} ago</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="num text-[12px] font-semibold text-accent">{a.agentId}</span>
          <span className="text-[12px] text-ink-3">wants to</span>
          <span className="rounded bg-raised px-1.5 py-0.5 text-[11.5px] text-ink-1">{toolLabel(a.toolCall.tool)}</span>
          {amount && <span className="num text-[12px] font-semibold text-allow">{amount}</span>}
          {a.toolCall.recipient && (
            <span className="num min-w-0 truncate text-[11.5px] text-ink-2">→ {a.toolCall.recipient}</span>
          )}
          <span className="num ml-auto hidden text-[11px] text-ink-4 sm:block">{fmtAge(a.createdAt)} ago</span>
        </div>

        <p className="mt-2 border-l-2 pl-2.5 text-[12px] leading-relaxed text-ink-2" style={{ borderColor: "var(--hold)" }}>
          {a.reason}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="btn btn-allow btn-sm"
            onClick={() => decide(a.id, true)}
            title="Guardian makes this exact call on PayPal, once, and records the order id"
          >
            <Icon.check size={12} /> Approve &amp; execute
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => decide(a.id, false)} title="Refuse it and tell the agent not to retry">
            <Icon.x size={12} /> Deny
          </button>
          <span className="num text-[11px] text-ink-4">{a.id}</span>
          <span className="text-[11px] text-ink-4">approving sends this one request to PayPal — nothing else</span>
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
      <div data-tour="queue">
        <Section
          title="Waiting for you"
          meta={`${pending.length} open · ${decided.length} decided`}
          help="Requests that tripped a rule. They never reached PayPal — this queue is the reason why."
        >
          {pending.length === 0 ? (
            <EmptyState
              icon={<Icon.inbox size={16} />}
              title="Nothing is waiting"
              body="No request needs a decision right now. Run the rogue drain or the prompt-injection scenario and both will put items in this queue for you to judge."
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
      </div>

      {decided.length > 0 && (
        <Section
          title="Already decided"
          meta={`${executed} sent to PayPal · ${decided.length - executed} refused`}
          help="The record of every human call made in this queue, either way."
          right={<div className="w-40"><DecisionBar parts={[{ key: "approved", count: executed }, { key: "denied", count: decided.length - executed }]} /></div>}
        >
          <div className="panel overflow-hidden">
            <div className="max-h-[380px] overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-[112px] tip" data-tip="What the person chose, and whether money actually moved.">Outcome</th>
                    <th className="tip" data-tip="The agent whose request this was.">Agent</th>
                    <th className="tip" data-tip="The request it was waiting on.">Request</th>
                    <th className="w-[54px] right tip" data-tip="Risk score at the moment it was held.">Risk</th>
                    <th className="w-[92px] right tip" data-tip="When the decision was made.">When</th>
                  </tr>
                </thead>
                <tbody>
                  {decided.slice(0, 25).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Chip kind={a.executed ? "executed" : a.status === "approved" ? "approved" : "denied"} />
                      </td>
                      <td className="num nowrap text-accent">{a.agentId}</td>
                      <td className="mono max-w-[280px] truncate">
                        {toolLabel(a.toolCall.tool)}
                        {a.toolCall.recipient ? ` → ${a.toolCall.recipient}` : ""}
                        {a.toolCall.amount ? ` · ${money(a.toolCall.amount)}` : ""}
                      </td>
                      <td className="right num" style={{ color: riskTone(a.riskScore).color }}>{a.riskScore}</td>
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
