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
  switch (config.provider) {
    case "gemini":
      return new GeminiClient(config.apiKey);
    case "openai":
      return new OpenAIClient(config.apiKey, "https://api.openai.com/v1");
    case "openrouter":
      return new OpenAIClient(config.apiKey, "https://openrouter.ai/api/v1");
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
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
