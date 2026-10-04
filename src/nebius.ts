// LLM access via Nebius Token Factory (OpenAI-compatible endpoint).
// All model IDs come from env — verify exact IDs on the Token Factory dashboard.

import OpenAI from 'openai';
import type { ChatCompletionCreateParams } from 'openai/resources/chat/completions';
import { z } from 'zod';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.NEBIUS_API_KEY;
  const baseURL = process.env.NEBIUS_BASE_URL;
  if (!apiKey) throw new Error('NEBIUS_API_KEY is not set (see .env.example)');
  if (!baseURL) throw new Error('NEBIUS_BASE_URL is not set (see .env.example)');
  client = new OpenAI({ apiKey, baseURL });
  return client;
}

export function reasoningModel(): string {
  const m = process.env.NEBIUS_MODEL_REASONING;
  if (!m) throw new Error('NEBIUS_MODEL_REASONING is not set (see .env.example)');
  return m;
}

export function fastModel(): string {
  const m = process.env.NEBIUS_MODEL_FAST;
  if (!m) throw new Error('NEBIUS_MODEL_FAST is not set (see .env.example)');
  return m;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /**
   * Set false to disable the model's thinking trace. Reasoning-style
   * models can spend the whole token budget on "Here's a thinking
   * process…" and never emit the JSON answer — disable for structured
   * planning/extraction calls. Passed as chat_template_kwargs
   * (vLLM-style) which Nebius Token Factory honors.
   */
  thinking?: boolean;
  /** Label for token-usage accounting (e.g. 'planning', 'summarizing'). */
  label?: string;
}

export interface StageUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
}

const usageByLabel = new Map<string, StageUsage>();

/** Clear accumulated token usage (call at the start of each run). */
export function resetUsage(): void {
  usageByLabel.clear();
}

/** Snapshot of token usage accumulated by labeled chat() calls. */
export function getUsage(): Map<string, StageUsage> {
  return new Map(usageByLabel);
}

type ChatBody = ChatCompletionCreateParams & {
  chat_template_kwargs?: Record<string, unknown>;
};

export async function chat(
  model: string,
  system: string,
  user: string,
  opts: ChatOptions = {},
): Promise<string> {
  const body: ChatBody = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.thinking === false) {
    body.chat_template_kwargs = { enable_thinking: false };
  }
  const res = await getClient().chat.completions.create(body);
  if (opts.label && res.usage) {
    const u = usageByLabel.get(opts.label) ?? {
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
    };
    u.calls += 1;
    u.promptTokens += res.usage.prompt_tokens ?? 0;
    u.completionTokens += res.usage.completion_tokens ?? 0;
    usageByLabel.set(opts.label, u);
  }
  return res.choices[0]?.message?.content?.trim() ?? '';
}

/**
 * Extract the first balanced {...} JSON object from model output.
 * Models often wrap JSON in prose, code fences, or emit it twice —
 * a naive first-"{"-to-last-"}" slice breaks on all of those.
 * This scans for balanced braces (string-aware) and parses the
 * first candidate that is valid JSON.
 */
export function extractJson(text: string): unknown {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(i, j + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break; // balanced but not valid JSON — try next '{'
          }
        }
      }
    }
  }
  throw new Error(
    `No valid JSON object found in model output: ${text.slice(0, 200)}`,
  );
}

/**
 * Chat + extract JSON + schema-validate, with one automatic retry that
 * reinforces "JSON only" when the first attempt comes back messy.
 */
export async function chatJson<T>(
  model: string,
  system: string,
  user: string,
  schema: z.ZodType<T>,
  opts: ChatOptions = {},
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? user
        : `${user}\n\nSTRICT: output ONLY the JSON object. No prose, no markdown fences, no explanation before or after.`;
    try {
      const raw = await chat(model, system, prompt, opts);
      return schema.parse(extractJson(raw));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Model did not return valid JSON after 2 attempts: ${
      lastError instanceof Error ? lastError.message : lastError
    }`,
  );
}
