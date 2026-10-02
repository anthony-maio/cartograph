/**
 * Unified LLM provider abstraction.
 *
 * Supports:
 *  - Google Gemini (native SDK, structured JSON output)
 *  - OpenAI (GPT-4.1 family, JSON mode)
 *  - OpenRouter (200+ models via OpenAI-compatible API)
 *
 * All providers expose a single `generate()` that returns parsed JSON or raw text.
 */
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import type { LLMConfig, ProviderId } from "./schema";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------
export interface GenerateOptions {
  prompt: string;
  json?: boolean;       // request structured JSON output
  temperature?: number; // default 0.1 for summaries, 0.3 for synthesis
}

export interface LLMClient {
  generate(model: string, opts: GenerateOptions): Promise<string>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createLLMClient(config: LLMConfig): LLMClient {
  return withRetries(createBaseClient(config));
}

function createBaseClient(config: LLMConfig): LLMClient {
  switch (config.provider) {
    case "gemini":
      return new GeminiClient(config.apiKey);
    case "openai":
      return new OpenAIClient(config.apiKey, "https://api.openai.com/v1");
    case "openrouter":
      return new OpenAIClient(config.apiKey, "https://openrouter.ai/api/v1");
    case "ollama":
      return new OpenAIClient(config.apiKey || "ollama", getOllamaBaseUrl());
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// Honors OLLAMA_HOST the same way the ollama CLI does ("host:port" or a full URL)
export function getOllamaBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const host = env.OLLAMA_HOST?.trim();
  if (!host) return "http://localhost:11434/v1";
  const hasScheme = /^https?:\/\//.test(host);
  const url = new URL(hasScheme ? host : `http://${host}`);
  // Like ollama: a bare host defaults to 11434, an explicit scheme keeps its own default port
  if (!hasScheme && !url.port) url.port = "11434";
  return `${url.origin}/v1`;
}

// ---------------------------------------------------------------------------
// Retries + timeout
// ---------------------------------------------------------------------------
export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export function isRetryableError(err: unknown): boolean {
  if (err instanceof LLMTimeoutError) return true;
  const e = err as { status?: unknown; code?: unknown; name?: unknown } | null;
  if (!e || typeof e !== "object") return false;
  if (typeof e.status === "number") return RETRYABLE_STATUS.has(e.status);
  if (typeof e.code === "string") return ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "UND_ERR_SOCKET"].includes(e.code);
  return e.name === "APIConnectionError" || e.name === "APIConnectionTimeoutError";
}

export class LLMTimeoutError extends Error {
  constructor(ms: number) {
    super(`LLM request timed out after ${ms}ms`);
    this.name = "LLMTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LLMTimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function withRetries(client: LLMClient, opts: RetryOptions = {}): LLMClient {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));

  return {
    async generate(model, generateOpts) {
      for (let attempt = 0; ; attempt++) {
        try {
          return await withTimeout(client.generate(model, generateOpts), timeoutMs);
        } catch (err) {
          if (attempt >= retries || !isRetryableError(err)) throw err;
          const jitter = Math.random() * baseDelayMs;
          await sleep(baseDelayMs * 2 ** attempt + jitter);
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Google Gemini — native SDK
// ---------------------------------------------------------------------------
class GeminiClient implements LLMClient {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(model: string, opts: GenerateOptions): Promise<string> {
    const response = await this.ai.models.generateContent({
      model,
      contents: opts.prompt,
      config: {
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
        temperature: opts.temperature ?? 0.1,
      },
    });
    return response.text || "";
  }
}

// ---------------------------------------------------------------------------
// OpenAI / OpenRouter — OpenAI SDK with configurable base URL
// ---------------------------------------------------------------------------
class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor(apiKey: string, baseURL: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
      maxRetries: 0, // retries are handled by withRetries() so every provider behaves the same
      defaultHeaders: baseURL.includes("openrouter")
        ? { "HTTP-Referer": "https://github.com/anthony-maio/cartograph", "X-Title": "Cartograph" }
        : undefined,
    });
  }

  async generate(model: string, opts: GenerateOptions): Promise<string> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "user", content: opts.prompt },
    ];

    const completion = await this.client.chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.1,
      ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    });

    return completion.choices[0]?.message?.content || "";
  }
}
