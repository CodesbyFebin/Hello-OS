// Pluggable OpenAI-compatible chat provider (plain fetch, no SDK).
// Configured only via env; when unset every caller must fail with NO_AI_PROVIDER.

export const PROVIDERS = {
  openrouter: { baseURL: "https://openrouter.ai/api/v1" },
  // Kilo Code AI Gateway, OpenAI-compatible: https://kilo.ai/docs/gateway
  kilo: { baseURL: "https://ai-gateway.kilo.ai/api/v1" },
  custom: { baseURL: "" },
} as const;
export type ProviderName = keyof typeof PROVIDERS;

/** Free open-weight model on OpenRouter (verified on its live /models list, 2026-10-20). */
export const DEFAULT_MODEL = "google/gemma-4-31b-it:free";

export class NoAIProviderError extends Error {
  code = "NO_AI_PROVIDER" as const;
  constructor(detail?: string) {
    super(`no AI provider configured${detail ? `: ${detail}` : ""}. Set HELLO_AI_PROVIDER (openrouter|kilo|custom) and HELLO_AI_API_KEY.`);
    this.name = "NoAIProviderError";
  }
}

export class AIRequestError extends Error {
  status: number;
  code: "AI_TIMEOUT" | "AI_RATE_LIMITED" | "AI_UPSTREAM_ERROR";
  retryAfterMs?: number;
  constructor(message: string, status: number, code: "AI_TIMEOUT" | "AI_RATE_LIMITED" | "AI_UPSTREAM_ERROR", retryAfterMs?: number) {
    super(message);
    this.status = status; this.code = code; this.retryAfterMs = retryAfterMs;
    this.name = "AIRequestError";
  }
}

export type AIConfig = { provider: ProviderName; baseURL: string; apiKey: string; model: string; timeoutMs: number; maxRetries: number };

type Env = Record<string, string | undefined>;

/** Returns the config, or a reason it is not configured. Never returns the key to callers that log. */
export function resolveAIConfig(env: Env = process.env): { ok: true; config: AIConfig } | { ok: false; reason: string } {
  const p = (env.HELLO_AI_PROVIDER ?? "").trim().toLowerCase();
  if (!p) return { ok: false, reason: "HELLO_AI_PROVIDER is not set" };
  if (!(p in PROVIDERS)) return { ok: false, reason: `unknown HELLO_AI_PROVIDER "${p}"` };
  const provider = p as ProviderName;
  const baseURL = (env.HELLO_AI_BASE_URL?.trim() || PROVIDERS[provider].baseURL).replace(/\/+$/, "");
  if (!baseURL) return { ok: false, reason: "HELLO_AI_BASE_URL is required for provider custom" };
  const apiKey = env.HELLO_AI_API_KEY?.trim() ?? "";
  if (!apiKey) return { ok: false, reason: "HELLO_AI_API_KEY is not set" };
  const timeoutMs = Number(env.HELLO_AI_TIMEOUT_MS) > 0 ? Number(env.HELLO_AI_TIMEOUT_MS) : 30_000;
  const maxRetries = Number.isInteger(Number(env.HELLO_AI_MAX_RETRIES)) && Number(env.HELLO_AI_MAX_RETRIES) >= 0 ? Number(env.HELLO_AI_MAX_RETRIES) : 2;
  return { ok: true, config: { provider, baseURL, apiKey, model: env.HELLO_AI_MODEL?.trim() || DEFAULT_MODEL, timeoutMs, maxRetries } };
}

export function aiProviderConfigured(env: Env = process.env): boolean {
  return resolveAIConfig(env).ok;
}

/** Public status: no secrets. */
export function aiStatus(env: Env = process.env) {
  const r = resolveAIConfig(env);
  if (!r.ok) return { configured: false as const, reason: r.reason, providers: Object.keys(PROVIDERS), defaultModel: DEFAULT_MODEL };
  const { provider, baseURL, model, timeoutMs, maxRetries } = r.config;
  return { configured: true as const, provider, baseURL, model, timeoutMs, maxRetries };
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatResult = { output: string; model: string; latencyMs: number; usage: { promptTokens: number; completionTokens: number } ; attempts: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryAfterMs(h: string | null): number | undefined {
  if (!h) return undefined;
  const s = Number(h);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const t = Date.parse(h);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : undefined;
}

export async function chat(messages: ChatMessage[], opts: { config?: AIConfig; maxTokens?: number; temperature?: number; fetchImpl?: typeof fetch } = {}): Promise<ChatResult> {
  let config = opts.config;
  if (!config) {
    const r = resolveAIConfig();
    if (!r.ok) throw new NoAIProviderError(r.reason);
    config = r.config;
  }
  const f = opts.fetchImpl ?? fetch;
  const t0 = Date.now();
  let attempt = 0;
  for (;;) {
    attempt++;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), config.timeoutMs);
    let res: Response;
    try {
      res = await f(`${config.baseURL}/chat/completions`, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
          "x-title": "HELLO OS",
        },
        body: JSON.stringify({ model: config.model, messages, stream: false, max_tokens: opts.maxTokens ?? 1024, temperature: opts.temperature ?? 0 }),
      });
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") throw new AIRequestError(`AI request timed out after ${config.timeoutMs}ms`, 504, "AI_TIMEOUT");
      throw new AIRequestError(`AI request failed: ${e?.message ?? e}`, 502, "AI_UPSTREAM_ERROR");
    }
    clearTimeout(timer);
    if (res.status === 429 || res.status >= 500) {
      const wait = retryAfterMs(res.headers.get("retry-after")) ?? 500 * 2 ** (attempt - 1);
      if (attempt <= config.maxRetries && wait <= 10_000) { await sleep(wait); continue; }
      if (res.status === 429) throw new AIRequestError("AI provider rate limit reached", 429, "AI_RATE_LIMITED", wait);
      throw new AIRequestError(`AI provider returned ${res.status}`, 502, "AI_UPSTREAM_ERROR");
    }
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 300);
      throw new AIRequestError(`AI provider returned ${res.status}: ${text}`, 502, "AI_UPSTREAM_ERROR");
    }
    const json: any = await res.json().catch(() => null);
    const output = json?.choices?.[0]?.message?.content;
    if (typeof output !== "string") throw new AIRequestError("AI provider returned no message content", 502, "AI_UPSTREAM_ERROR");
    return {
      output,
      model: typeof json.model === "string" ? json.model : config.model,
      latencyMs: Date.now() - t0,
      usage: { promptTokens: Number(json.usage?.prompt_tokens) || 0, completionTokens: Number(json.usage?.completion_tokens) || 0 },
      attempts: attempt,
    };
  }
}
