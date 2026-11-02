"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Rule, ScenarioResult, State } from "@/components/console-model";

export type ProbeInput = {
  agentId: string;
  tool: string;
  recipient?: string;
  amount?: string;
  note?: string;
};

export type ProbeResult = {
  outcome: string;
  riskScore: number;
  explanation: string;
  matchedRuleIds?: string[];
  matchedRules?: string[];
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  return (await res.json()) as T;
}

/**
 * Single source of truth for the console: polls the ledger, exposes every
 * mutation, and owns the toast. Components stay presentational.
 */
export function useConsole(pollMs = 2500) {
  const [state, setState] = useState<State | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const online = useRef(true);

  const refresh = useCallback(() => {
    json<State>("/api/state", { cache: "no-store" })
      .then((s) => {
        online.current = true;
        setState(s);
      })
      .catch(() => {
        online.current = false;
      });
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  const ping = useCallback((msg: string, kind = "allow") => {
    setToast({ msg, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const runScenario = useCallback(
    async (kind: "rogue" | "injection" | "friendly") => {
      const r = await json<ScenarioResult>("/api/attack", {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      refresh();
      return r;
    },
    [refresh],
  );

  const decide = useCallback(
    async (id: string, approve: boolean) => {
      const r = await json<{ execution?: string }>("/api/approvals", {
        method: "POST",
        body: JSON.stringify({ id, approve }),
      });
      // The route actually ran the held call, so say what PayPal answered.
      const said = (r.execution ?? "").replace(/^[^A-Za-z]+/, "").replace(/\s+\[status \w+\]$/, "");
      ping(
        approve
          ? said
            ? `Approved — ${said.slice(0, 150)}`
            : "Approved — Guardian will run it when the agent checks back"
          : "Denied — agent told not to retry",
        approve ? "approved" : "denied",
      );
      refresh();
    },
    [ping, refresh],
  );

  const addPolicy = useCallback(
    async (nlText: string) => {
      const d = await json<{ rule?: Rule; error?: string }>("/api/policies", {
        method: "POST",
        body: JSON.stringify({ nlText }),
      });
      if (d.rule) {
        ping(`Rule compiled: ${d.rule.type.replace(/_/g, " ")}`, "allow");
        refresh();
      }
      return d;
    },
    [ping, refresh],
  );

  const patchPolicy = useCallback(
    async (id: string, action: "delete" | "toggle") => {
      await json("/api/policies", { method: "PUT", body: JSON.stringify({ id, action }) });
      refresh();
    },
    [refresh],
  );

  const clearLedger = useCallback(async () => {
    await json("/api/reset", { method: "POST" });
    ping("Ledger cleared — policies kept", "approval_decided");
    refresh();
  }, [ping, refresh]);

  const probe = useCallback(
    (input: ProbeInput) => json<ProbeResult>("/api/preview", { method: "POST", body: JSON.stringify(input) }),
    [],
  );

  return { state, refresh, ping, toast, runScenario, decide, addPolicy, patchPolicy, clearLedger, probe };
}
