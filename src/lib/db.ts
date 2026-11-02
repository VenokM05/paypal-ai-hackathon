import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type {
  ApprovalRequest,
  AuditEvent,
  GuardianAgent,
  PolicyRule,
} from "./types";

/**
 * Where the ledger lives, in order of preference:
 *   1. GUARDIAN_DB_PATH (set it to ":memory:" to force an in-memory ledger)
 *   2. <cwd>/data/guardian.db          — a normal checkout or long-lived server
 *   3. <tmpdir>/guardian/guardian.db   — read-only filesystems (Vercel, Railway…)
 *   4. in-memory                       — nothing writable at all
 *
 * On a serverless platform each cold start gets a fresh database, so the demo
 * ledger re-seeds itself per instance. Everything stays functional; history from
 * an earlier request may be gone. Set GUARDIAN_DB_PATH to a mounted volume for
 * durable state.
 */
function candidates(): string[] {
  const fromEnv = process.env.GUARDIAN_DB_PATH?.trim();
  const out = fromEnv ? [fromEnv] : [];
  out.push(
    path.join(process.cwd(), "data", "guardian.db"),
    path.join(os.tmpdir(), "guardian", "guardian.db"),
    ":memory:",
  );
  return out;
}

function open(candidate: string): Database.Database | null {
  try {
    if (candidate !== ":memory:") {
      fs.mkdirSync(path.dirname(candidate), { recursive: true });
      // Prove the directory is actually writable before trusting it.
      const probe = path.join(path.dirname(candidate), ".guardian-write-test");
      fs.writeFileSync(probe, "ok");
      fs.rmSync(probe, { force: true });
    }
    const d = new Database(candidate);
    d.pragma("journal_mode = WAL");
    d.prepare("SELECT 1").get();
    return d;
  } catch {
    return null;
  }
}

export let dbLocation = "in memory";

export function getDbLocation(): string {
  return dbLocation;
}

/**
 * How durable the opened ledger is, for the UI to say so honestly:
 *   "local"     — inside the project directory, survives restarts
 *   "ephemeral" — a temp directory; per-instance on serverless, re-seeds on cold start
 *   "memory"    — nothing writable at all, gone when the request ends
 */
export function getLedgerMode(): "local" | "ephemeral" | "memory" {
  getDb();
  if (dbLocation === ":memory:") return "memory";
  const tmp = path.resolve(os.tmpdir());
  return dbLocation.startsWith(tmp) ? "ephemeral" : "local";
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const tried: string[] = [];
  for (const candidate of candidates()) {
    const opened = open(candidate);
    if (opened) {
      db = opened;
      dbLocation = candidate;
      migrate(db);
      return db;
    }
    tried.push(candidate);
  }
  throw new Error(`Guardian could not open a database (tried: ${tried.join(", ")})`);
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      trust_level TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);
  seed(d);
}

function newId() {
  return crypto.randomUUID();
}

function seed(d: Database.Database) {
  const count = d.prepare("SELECT COUNT(*) AS n FROM agents").get() as {
    n: number;
  };
  if (count.n > 0) return;
  const now = new Date().toISOString();
  const insertAgent = d.prepare(
    "INSERT INTO agents (id, name, description, trust_level, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  insertAgent.run("shopping-assistant", "Shopping Assistant", "Helps the user buy things online on their behalf.", "high", now);
  insertAgent.run("freelance-biller", "Freelance Biller", "Chases invoices for a solo freelancer.", "medium", now);
  insertAgent.run("unknown-agent", "Unknown Agent", "An agent added from a third-party plugin. Untrusted.", "low", now);

  // Default starter policies so the demo works out of the box.
  const defaults: Omit<PolicyRule, "id" | "createdAt">[] = [
    { agentId: "*", type: "amount_limit", params: { value: 200, currency: "USD" }, action: "require_approval", reason: "Single payments over $200 need a human OK.", source: "default", enabled: true },
    { agentId: "*", type: "daily_total_limit", params: { value: 500, currency: "USD" }, action: "block", reason: "An agent may not move more than $500 total per day.", source: "default", enabled: true },
    { agentId: "*", type: "velocity_limit", params: { perMinute: 3 }, action: "block", reason: "More than 3 transactions per minute looks like a runaway loop.", source: "default", enabled: true },
    { agentId: "*", type: "new_recipient_approval", params: {}, action: "require_approval", reason: "First-ever payment to a new recipient needs a human OK.", source: "default", enabled: true },
    { agentId: "*", type: "approval_required_tools", params: { tools: ["open_dispute"] }, action: "require_approval", reason: "Opening a dispute is a legal action and always needs a human.", source: "default", enabled: true },
    { agentId: "unknown-agent", type: "tool_whitelist", params: { tools: ["search_transactions"] }, action: "block", reason: "Untrusted agents are read-only; they may not move money.", source: "default", enabled: true },
  ];
  const ins = d.prepare("INSERT INTO policies (id, data) VALUES (?, ?)");
  for (const p of defaults) {
    ins.run(newId(), JSON.stringify({ id: newId(), createdAt: now, ...p } satisfies PolicyRule));
  }
}

function rows<T>(d: Database.Database, sql: string): T[] {
  return (d.prepare(sql).all() as { data: string }[]).map((r) => JSON.parse(r.data) as T);
}

// ---------- agents ----------
export function listAgents(): GuardianAgent[] {
  const d = getDb();
  return (d.prepare("SELECT * FROM agents").all() as Record<string, string>[]).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    trustLevel: r.trust_level as GuardianAgent["trustLevel"],
    createdAt: r.created_at,
  }));
}

// ---------- policies ----------
export function listPolicies(): PolicyRule[] {
  return rows<PolicyRule>(getDb(), "SELECT data FROM policies");
}

export function savePolicy(rule: PolicyRule) {
  const d = getDb();
  d.prepare("INSERT OR REPLACE INTO policies (id, data) VALUES (?, ?)").run(rule.id, JSON.stringify(rule));
}

export function deletePolicy(id: string) {
  getDb().prepare("DELETE FROM policies WHERE id = ?").run(id);
}

/** Wipe the transactional history (audit + approvals); keeps agents and policies. */
export function clearLedger() {
  const d = getDb();
  d.prepare("DELETE FROM audit").run();
  d.prepare("DELETE FROM approvals").run();
}

export function newPolicyId() {
  return newId();
}

// ---------- approvals ----------
export function saveApproval(a: ApprovalRequest) {
  getDb().prepare("INSERT OR REPLACE INTO approvals (id, data) VALUES (?, ?)").run(a.id, JSON.stringify(a));
}

export function getApproval(id: string): ApprovalRequest | undefined {
  const r = getDb().prepare("SELECT data FROM approvals WHERE id = ?").get(id) as { data: string } | undefined;
  return r ? (JSON.parse(r.data) as ApprovalRequest) : undefined;
}

export function listApprovals(): ApprovalRequest[] {
  return rows<ApprovalRequest>(getDb(), "SELECT data FROM approvals").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------- audit ----------
export function recordAudit(e: Omit<AuditEvent, "id">): AuditEvent {
  const full: AuditEvent = { id: newId(), ...e };
  getDb().prepare("INSERT INTO audit (id, data) VALUES (?, ?)").run(full.id, JSON.stringify(full));
  return full;
}

export function listAudit(limit = 200): AuditEvent[] {
  return rows<AuditEvent>(getDb(), "SELECT data FROM audit")
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Sum of amounts (in cents, USD) an agent moved today, from audit trail. */
export function dailySpendCents(agentId: string): number {
  const day = new Date().toISOString().slice(0, 10);
  const events = rows<AuditEvent>(getDb(), "SELECT data FROM audit").filter(
    (e) => e.agentId === agentId && e.outcome === "executed" && e.at.slice(0, 10) === day,
  );
  let total = 0;
  for (const e of events) {
    const m = /amount=(\d+\.\d{2})/.exec(e.argsSummary);
    if (m) total += Math.round(parseFloat(m[1]) * 100);
  }
  return total;
}

/** Count of executed tx by agent in the last N minutes (velocity check). */
export function recentTxCount(agentId: string, minutes: number): number {
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  return rows<AuditEvent>(getDb(), "SELECT data FROM audit").filter(
    (e) => e.agentId === agentId && e.outcome === "executed" && e.at >= cutoff,
  ).length;
}

/** Has this agent ever paid this recipient before? */
export function hasPriorPayment(agentId: string, recipient: string): boolean {
  return rows<AuditEvent>(getDb(), "SELECT data FROM audit").some(
    (e) => e.agentId === agentId && e.outcome === "executed" && e.argsSummary.includes(`to=${recipient}`),
  );
}
