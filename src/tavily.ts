// Thin wrapper around the Tavily Search + Extract APIs.
// Docs: https://docs.tavily.com

import type { SearchHit } from './agent/types.js';

const BASE = 'https://api.tavily.com';

function apiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY is not set (see .env.example)');
  return key;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey(), ...body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Tavily ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface TavilySearchOptions {
  maxResults?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  excludeDomains?: string[];
}

interface TavilySearchResponse {
  results: {
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
  }[];
}

/** Advanced web search tuned for fresh crypto intel. */
export async function tavilySearch(
  query: string,
  opts: TavilySearchOptions = {},
): Promise<SearchHit[]> {
  const data = await post<TavilySearchResponse>('/search', {
    query,
    search_depth: 'advanced',
    max_results: opts.maxResults ?? 8,
    time_range: opts.timeRange ?? 'week',
    exclude_domains: opts.excludeDomains ?? [],
    include_answer: false,
  });
  return data.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
    publishedDate: r.published_date,
  }));
}

interface TavilyExtractResponse {
  results: { url: string; title?: string; raw_content: string }[];
  failed_results: { url: string; error: string }[];
}

/** Pull full clean text from a list of URLs. Failed URLs are skipped.
 *  Pass `query` to narrow extraction to query-relevant chunks (smaller,
 *  faster, more relevant). */
export async function tavilyExtract(
  urls: string[],
  query?: string,
): Promise<{ url: string; title: string; text: string }[]> {
  if (urls.length === 0) return [];
  const data = await post<TavilyExtractResponse>('/extract', {
    urls,
    extract_depth: 'advanced',
    ...(query ? { query } : {}),
  });
  return data.results
    .filter((r) => r.raw_content && r.raw_content.trim().length > 200)
    .map((r) => ({
      url: r.url,
      title: r.title ?? r.url,
      text: r.raw_content,
    }));
}
