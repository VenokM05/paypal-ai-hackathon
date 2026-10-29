import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  ApprovalRequest,
  AuditEvent,
  GuardianAgent,
  PolicyRule,
} from "./types";

const DB_PATH =
  process.env.GUARDIAN_DB_PATH ||
  path.join(process.cwd(), "data", "guardian.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
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
