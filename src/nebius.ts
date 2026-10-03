// LLM access via Nebius Token Factory (OpenAI-compatible endpoint).
// All model IDs come from env — verify exact IDs on the Token Factory dashboard.

import OpenAI from 'openai';

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
 * Extract the first JSON object from model output.
 * Models sometimes wrap JSON in prose/code fences — this recovers it.
 */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in model output: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}
