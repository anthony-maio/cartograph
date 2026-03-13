import { z } from "zod";

// === Provider Config ===
export const PROVIDERS = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    description: "Best value. Flash-Lite for summaries, Flash for synthesis.",
    keyPlaceholder: "Gemini API key (ai.google.dev)",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultFastModel: "gemini-3.1-flash-lite-preview",
    defaultStrongModel: "gemini-2.5-flash-preview-05-20",
    models: [
      { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash-Lite", tier: "fast" },
      { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash", tier: "strong" },
      { id: "gemini-2.5-pro-preview-06-05", name: "Gemini 2.5 Pro", tier: "strong" },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4.1 mini for summaries, GPT-4.1 for synthesis.",
    keyPlaceholder: "OpenAI API key (platform.openai.com)",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultFastModel: "gpt-4.1-mini",
    defaultStrongModel: "gpt-4.1",
    models: [
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", tier: "fast" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", tier: "fast" },
      { id: "gpt-4.1", name: "GPT-4.1", tier: "strong" },
      { id: "o4-mini", name: "o4-mini", tier: "strong" },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 200+ models. Use any provider through one API.",
    keyPlaceholder: "OpenRouter API key (openrouter.ai)",
    keyUrl: "https://openrouter.ai/keys",
    defaultFastModel: "google/gemini-2.5-flash-preview",
    defaultStrongModel: "anthropic/claude-sonnet-4",
    models: [
      { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", tier: "fast" },
      { id: "google/gemini-2.5-flash-lite-preview", name: "Gemini 2.5 Flash-Lite", tier: "fast" },
      { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", tier: "strong" },
      { id: "anthropic/claude-haiku-3.5", name: "Claude 3.5 Haiku", tier: "fast" },
      { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", tier: "fast" },
      { id: "openai/gpt-4.1", name: "GPT-4.1", tier: "strong" },
      { id: "deepseek/deepseek-chat-v3", name: "DeepSeek V3", tier: "fast" },
      { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", tier: "strong" },
    ],
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Run models locally via Ollama. No API key needed.",
    keyPlaceholder: "Not required",
    keyUrl: "https://ollama.com",
    defaultFastModel: "qwen3:8b",
    defaultStrongModel: "qwen3:32b",
    models: [
      { id: "qwen3:8b", name: "Qwen 3 8B", tier: "fast" },
      { id: "qwen3:32b", name: "Qwen 3 32B", tier: "strong" },
      { id: "llama3.1:8b", name: "Llama 3.1 8B", tier: "fast" },
      { id: "llama3.1:70b", name: "Llama 3.1 70B", tier: "strong" },
      { id: "deepseek-r1:14b", name: "DeepSeek R1 14B", tier: "fast" },
      { id: "deepseek-r1:32b", name: "DeepSeek R1 32B", tier: "strong" },
      { id: "gemma3:12b", name: "Gemma 3 12B", tier: "fast" },
      { id: "gemma3:27b", name: "Gemma 3 27B", tier: "strong" },
    ],
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

// === Input Schemas ===
export const analyzeRequestSchema = z.object({
  repoUrl: z.string().min(1, "Repository URL is required"),
  branch: z.string().optional(),
  apiKey: z.string().min(1, "API key is required"),
  provider: z.enum(["gemini", "openai", "openrouter", "ollama"]).default("gemini"),
  fastModel: z.string().optional(),
  strongModel: z.string().optional(),
});

export const contextRequestSchema = z.object({
  task: z.string().min(1, "Task description is required"),
  apiKey: z.string().min(1, "API key is required"),
  provider: z.enum(["gemini", "openai", "openrouter", "ollama"]).default("gemini"),
  fastModel: z.string().optional(),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type ContextRequest = z.infer<typeof contextRequestSchema>;

// === LLM Config passed through pipeline ===
export interface LLMConfig {
  apiKey: string;
  provider: ProviderId;
  fastModel: string;
  strongModel: string;
}

// === Analysis Types ===
export interface FileNode {
  path: string;
  language: string;
  lines: number;
  bytes: number;
  imports: string[];
  exports: string[];
  importanceScore: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface FileSummary {
  path: string;
  purpose: string;
  publicApi: string;
  dependencies: string[];
  architecturalRole: string;
}

export interface ModuleDoc {
  name: string;
  description: string;
  files: FileSummary[];
}

export interface ContextGuide {
  taskType: string;
  relevantFiles: string[];
  explanation: string;
}

export interface WikiResult {
  repoName: string;
  overview: string;
  architecture: string;
  patterns: string;
  modules: ModuleDoc[];
  contextGuide: ContextGuide[];
  totalFiles: number;
  analyzedFiles: number;
  totalTokensSaved: number;
}

export interface AnalysisJob {
  id: string;
  status: 'cloning' | 'analyzing' | 'summarizing' | 'synthesizing' | 'complete' | 'error';
  progress: number;
  message: string;
  repoUrl: string;
  provider: ProviderId;
  result?: WikiResult;
  fileAnalysis?: FileNode[];
  fileSummaries?: FileSummary[];
  dependencyEdges?: DependencyEdge[];
  error?: string;
  startedAt: number;
}
