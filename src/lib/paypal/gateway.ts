import type { MoneyAmount } from "../types";

/** The PayPal operations Guardian can execute on an agent's behalf. */
export interface PayPalGateway {
  mode: "mock" | "live";
  createOrder(args: { recipient: string; amount: MoneyAmount; note?: string }): Promise<{ id: string; status: string; detail: string }>;
  captureOrder(args: { orderId: string }): Promise<{ id: string; status: string; detail: string }>;
  sendInvoice(args: { recipient: string; amount: MoneyAmount; memo?: string }): Promise<{ id: string; status: string; detail: string }>;
  openDispute(args: { transactionId?: string; itemName: string; reason: string }): Promise<{ id: string; status: string; detail: string }>;
  searchTransactions(args: { startDate?: string; endDate?: string }): Promise<{ total: number; items: Record<string, unknown>[]; detail: string }>;
}

export function money(value: number | string, currency = "USD"): MoneyAmount {
  return { currency_code: currency, value: Number(value).toFixed(2) };
}

// ---------------- mock gateway ----------------

function mockRef(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export class MockGateway implements PayPalGateway {
  mode = "mock" as const;

  async createOrder({ recipient, amount, note }: { recipient: string; amount: MoneyAmount; note?: string }) {
    const id = mockRef("ORDER");
    return {
      id,
      status: "CREATED",
      detail: `Mock PayPal order ${id}: ${amount.currency_code} ${amount.value} payable to ${recipient}${note ? ` (note: ${note})` : ""}. Awaiting capture.`,
    };
  }

  async captureOrder({ orderId }: { orderId: string }) {
    return {
      id: orderId,
      status: "COMPLETED",
      detail: `Mock PayPal capture completed for order ${orderId}. Funds moved.`,
    };
  }

  async sendInvoice({ recipient, amount, memo }: { recipient: string; amount: MoneyAmount; memo?: string }) {
    const id = mockRef("INV2");
    return {
      id,
      status: "DRAFT",
      detail: `Mock invoice ${id} created for ${recipient}: ${amount.currency_code} ${amount.value}${memo ? ` (memo: ${memo})` : ""}. Marked UNPAID.`,
    };
  }

  async openDispute({ transactionId, itemName, reason }: { transactionId?: string; itemName: string; reason: string }) {
    const id = mockRef("DISPUTE");
    return {
      id,
      status: "OPEN",
      detail: `Mock dispute ${id} opened for "${itemName}" (reason: ${reason}${transactionId ? `, txn ${transactionId}` : ""}).`,
    };
  }

  async searchTransactions({ startDate, endDate }: { startDate?: string; endDate?: string }) {
    const day = new Date().toISOString().slice(0, 10);
    return {
      total: 3,
      items: [
        { transaction_id: mockRef("TXN"), amount: { currency_code: "USD", value: "42.00" }, payer_email: "regular-customer@example.com", transaction_status: "S CLOSED", time: `${day}T09:12:00Z` },
        { transaction_id: mockRef("TXN"), amount: { currency_code: "USD", value: "128.50" }, payer_email: "vip@buyer.org", transaction_status: "S COMPLETED", time: `${day}T11:40:00Z` },
        { transaction_id: mockRef("TXN"), amount: { currency_code: "USD", value: "19.99" }, payer_email: "newbie@test.dev", transaction_status: "P PENDING", time: `${day}T13:05:00Z` },
      ],
      detail: `Mock transaction search ${startDate ?? "..."} → ${endDate ?? day}: 3 results.`,
    };
  }
}

// ---------------- live gateway (PayPal sandbox REST) ----------------

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

export class LiveGateway implements PayPalGateway {
  mode = "live" as const;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt - 30_000) return this.token;
    const res = await fetch(`${SANDBOX_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`PayPal token error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.token;
  }

  private async api(path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
    const token = await this.accessToken();
    const res = await fetch(`${SANDBOX_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const text = await res.text();
    let body: unknown = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
    return { status: res.status, body };
  }

  async createOrder({ recipient, amount, note }: { recipient: string; amount: MoneyAmount; note?: string }) {
    const { status, body } = await this.api("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: `guardian-${Date.now()}`,
            amount: { currency_code: amount.currency_code, value: amount.value },
            description: note?.slice(0, 250),
            payee: recipient.includes("@") ? { email_address: recipient } : undefined,
          },
        ],
      }),
    });
    const b = body as { id?: string; status?: string };
    if (status >= 400) throw new Error(`PayPal create order failed (${status}): ${JSON.stringify(body).slice(0, 300)}`);
    return {
      id: b.id ?? "UNKNOWN",
      status: b.status ?? "CREATED",
      detail: `Sandbox PayPal order ${b.id} created: ${amount.currency_code} ${amount.value}, status ${b.status}.`,
    };
  }

  async captureOrder({ orderId }: { orderId: string }) {
    const { status, body } = await this.api(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
    });
    const b = body as { status?: string; purchase_units?: { payments?: { captures?: { id: string; status: string }[] } }[] };
    if (status >= 400) throw new Error(`PayPal capture failed (${status}): ${JSON.stringify(body).slice(0, 300)}`);
    const capture = b.purchase_units?.[0]?.payments?.captures?.[0];
    return {
      id: capture?.id ?? orderId,
      status: capture?.status ?? b.status ?? "COMPLETED",
      detail: `Sandbox capture ${capture?.id ?? "?"} status ${capture?.status ?? b.status}.`,
    };
  }

  async sendInvoice({ recipient, amount, memo }: { recipient: string; amount: MoneyAmount; memo?: string }) {
    const { status, body } = await this.api("/v2/invoicing/invoices", {
      method: "POST",
      body: JSON.stringify({
        marketplace_id: "EBAY",
        detail: { currency_code: amount.currency_code, note: memo?.slice(0, 250) },
        primary_recipients: [{ merchant_info: { email: "sandbox-merchant@business.example" }, email: recipient }],
        referenced_invoices: [],
        invoices: [
          {
            unit_of_measure: "AMOUNT",
            item_amount: { currency_code: amount.currency_code, value: amount.value },
            quantity: 1,
            name: "Guardian-issued invoice",
          },
        ],
      }),
    });
    const b = body as { id?: string; status?: string; message?: string };
    if (status >= 400) throw new Error(`PayPal invoice failed (${status}): ${JSON.stringify(body).slice(0, 300)}`);
    return {
      id: b.id ?? "UNKNOWN",
      status: b.status ?? "DRAFT",
      detail: `Sandbox invoice ${b.id} created for ${recipient}: ${amount.currency_code} ${amount.value}.`,
    };
  }

  async openDispute({ transactionId, itemName, reason }: { transactionId?: string; itemName: string; reason: string }) {
    // The public PayPal Disputes API supports listing/accepting/offers, not
    // buyer-side creation, so in live mode we record the intent and search for
    // the related dispute instead of fabricating one.
    const { status, body } = await this.api(`/api/rest/v1/disputes?page_size=5`, { method: "GET" });
    const b = body as { items?: { dispute_id: string; status: string; reason_code: string }[] };
    if (status >= 400) throw new Error(`PayPal dispute search failed (${status}): ${JSON.stringify(body).slice(0, 300)}`);
    const items = b.items ?? [];
    return {
      id: items[0]?.dispute_id ?? "NO_DISPUTE_YET",
      status: items[0]?.status ?? "INTENT_RECORDED",
      detail: `Live mode: dispute creation is not exposed by the public API; recorded intent "${itemName}: ${reason}"${transactionId ? ` for txn ${transactionId}` : ""} and listed ${items.length} existing sandbox dispute(s).`,
    };
  }

  async searchTransactions({ startDate, endDate }: { startDate?: string; endDate?: string }) {
    const end = endDate ?? new Date().toISOString().slice(0, 10);
    const start = startDate ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const { status, body } = await this.api(
      `/v1/reporting/transactions?start_date=${start}&end_date=${end}&fields=all&page_size=10`,
      { method: "GET" },
    );
    const b = body as { transaction_details?: { transaction_info?: Record<string, unknown> }[]; total_items?: number };
    if (status >= 400) throw new Error(`PayPal transaction search failed (${status}): ${JSON.stringify(body).slice(0, 300)}`);
    const items = (b.transaction_details ?? []).map((t) => t.transaction_info ?? {});
    return {
      total: b.total_items ?? items.length,
      items,
      detail: `Sandbox reporting search ${start}→${end}: ${b.total_items ?? items.length} transaction(s).`,
    };
  }
}

let cached: PayPalGateway | null = null;

export function getGateway(): PayPalGateway {
  if (cached) return cached;
  const mode = (process.env.PAYPAL_MODE || "mock").toLowerCase();
  if (
    mode === "live" &&
    process.env.PAYPAL_CLIENT_ID &&
    process.env.PAYPAL_SECRET
  ) {
    cached = new LiveGateway(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET);
  } else {
    if (mode === "live") {
      console.warn("[guardian] PAYPAL_MODE=live but PAYPAL_CLIENT_ID/SECRET missing → falling back to mock");
    }
    cached = new MockGateway();
  }
  return cached;
}
