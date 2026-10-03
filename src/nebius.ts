// LLM access via Nebius Token Factory (OpenAI-compatible endpoint).
// All model IDs come from env — verify exact IDs on the Token Factory dashboard.

import OpenAI from 'openai';
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
}

export async function chat(
  model: string,
  system: string,
  user: string,
  opts: ChatOptions = {},
): Promise<string> {
  const res = await getClient().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2048,
  });
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
