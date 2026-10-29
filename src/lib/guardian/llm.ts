/**
 * Thin OpenAI-compatible chat helper. Works with OPENAI_API_KEY (or any
 * OpenAI-compatible endpoint via LLM_BASE_URL / LLM_MODEL). When no key is
 * configured, callers fall back to deterministic heuristics so the whole
 * product still runs with zero API keys.
 */

const BASE = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

export function llmAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function chat(
  system: string,
  user: string,
  opts: { json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  if (!llmAvailable()) throw new Error("no LLM configured");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: opts.maxTokens ?? 600,
      temperature: 0.2,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

export async function chatJson<T>(
  system: string,
  user: string,
  fallback: () => T,
): Promise<T> {
  if (!llmAvailable()) return fallback();
  try {
    const raw = await chat(
      system + "\nRespond with a single JSON object only.",
      user,
      { json: true },
    );
    return JSON.parse(stripFences(raw)) as T;
  } catch {
    return fallback();
  }
}

function stripFences(s: string): string {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  return (m ? m[1] : s).trim();
}
