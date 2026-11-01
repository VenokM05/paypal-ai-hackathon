"use client";

import { useCallback, useEffect, useState } from "react";
import type { TabId } from "@/components/console-model";
import { MobileTabs, NAV, Rail } from "@/components/shell";
import { StatusBar, TopBar } from "@/components/frame";
import { Skeleton, Toaster } from "@/components/ui";
import { ApprovalsTab } from "@/components/tabs/approvals";
import { AuditTab } from "@/components/tabs/audit";
import { PoliciesTab } from "@/components/tabs/policies";
import { ThreatLab } from "@/components/tabs/threat-lab";
import { useConsole } from "@/hooks/use-console";

const isTab = (v: string): v is TabId => NAV.some((n) => n.id === v);

/** Tabs live in the URL hash so a demo state is shareable and Back works. */
function useHashTab(fallback: TabId): [TabId, (t: TabId) => void] {
  // Always start on `fallback`: reading location.hash during the first render
  // would make the server HTML disagree with the client and cost a hydration
  // mismatch. The hash is adopted in the mount effect instead.
  const [tab, setTabState] = useState<TabId>(fallback);

  const setTab = useCallback((t: TabId) => {
    setTabState(t);
    if (window.location.hash !== `#/${t}`) window.location.hash = `#/${t}`;
  }, []);

  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace(/^#\/?/, "");
      if (isTab(h)) setTabState(h);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  return [tab, setTab];
}

export default function Console() {
  const { state, toast, ping, runScenario, decide, addPolicy, patchPolicy, clearLedger, probe } = useConsole();
  const [tab, setTab] = useHashTab("lab");

  // Number keys jump between sections, unless the user is typing in a field.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const i = Number(ev.key) - 1;
      if (i >= 0 && i < NAV.length) setTab(NAV[i].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTab]);

  // Rail tabs move with the arrow keys, like every real tablist.
  const onRailKey = useCallback(
    (ev: React.KeyboardEvent) => {
      const i = NAV.findIndex((n) => n.id === tab);
      if (ev.key === "ArrowDown" || ev.key === "ArrowRight") {
        ev.preventDefault();
        setTab(NAV[(i + 1) % NAV.length].id);
      } else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") {
        ev.preventDefault();
        setTab(NAV[(i - 1 + NAV.length) % NAV.length].id);
      }
    },
    [tab, setTab],
  );

  useEffect(() => {
    const el = document.getElementById(`tab-${tab}`);
    if (el && document.activeElement?.getAttribute("role") === "tab") el.focus();
  }, [tab]);

  const pending = state?.approvals.filter((a) => a.status === "pending").length ?? 0;
  const counts: Record<TabId, number> = {
    lab: 0,
    approvals: pending,
    policies: state?.policies.length ?? 0,
    audit: state?.audit.length ?? 0,
  };
  const title = NAV.find((n) => n.id === tab)?.label ?? "Console";

  return (
    <div className="min-h-screen" onKeyDown={onRailKey}>
      <Rail tab={tab} setTab={setTab} counts={counts} />

      <div className="flex min-h-screen flex-col md:pl-[216px]">
        <TopBar state={state} pending={pending} title={title} />
        <MobileTabs tab={tab} setTab={setTab} counts={counts} />

        <main
          id="panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          tabIndex={-1}
          className="mx-auto w-full max-w-[1220px] flex-1 px-4 py-5 outline-none sm:px-6"
        >
          {!state ? (
            <Skeleton rows={4} />
          ) : tab === "lab" ? (
            <ThreatLab state={state} runScenario={runScenario} clearLedger={clearLedger} probe={probe} ping={ping} />
          ) : tab === "approvals" ? (
            <ApprovalsTab state={state} decide={decide} goLab={() => setTab("lab")} />
          ) : tab === "policies" ? (
            <PoliciesTab state={state} addPolicy={addPolicy} patchPolicy={patchPolicy} />
          ) : (
            <AuditTab state={state} />
          )}
        </main>

        <StatusBar state={state} />
      </div>

      {toast && <Toaster msg={toast.msg} kind={toast.kind} />}
    </div>
  );
}
