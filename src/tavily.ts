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

// --- Usage accounting: real credits from include_usage, estimate as fallback ---
export interface TavilyUsage {
  /** Search API calls made */
  searchCalls: number;
  /** URLs sent to extract */
  extractedUrls: number;
  /** Credits consumed by search (real from API, else 2/call estimate) */
  searchCredits: number;
  /** Credits consumed by extract (real from API, else 0.4/URL estimate) */
  extractCredits: number;
}

let tavilyUsage: TavilyUsage = {
  searchCalls: 0,
  extractedUrls: 0,
  searchCredits: 0,
  extractCredits: 0,
};

/** Clear accumulated usage (call at the start of each run). */
export function resetTavilyUsage(): void {
  tavilyUsage = { searchCalls: 0, extractedUrls: 0, searchCredits: 0, extractCredits: 0 };
}

/** Snapshot of Tavily usage for this run. */
export function getTavilyUsage(): TavilyUsage {
  return { ...tavilyUsage };
}

interface TavilySearchResponse {
  results: {
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
  }[];
  usage?: { credits?: number };
}

/** Advanced web search tuned for fresh crypto intel. */
export async function tavilySearch(
  query: string,
  opts: TavilySearchOptions = {},
): Promise<SearchHit[]> {
  tavilyUsage.searchCalls += 1;
  const data = await post<TavilySearchResponse>('/search', {
    query,
    search_depth: 'advanced',
    max_results: opts.maxResults ?? 8,
    time_range: opts.timeRange ?? 'week',
    exclude_domains: opts.excludeDomains ?? [],
    include_answer: false,
    include_usage: true,
  });
  // Real credits from the API; fall back to the validated advanced rate (2).
  tavilyUsage.searchCredits += data.usage?.credits ?? 2;
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
  usage?: { credits?: number };
}

/** Pull full clean text from a list of URLs. Failed URLs are skipped.
 *  Pass `query` to narrow extraction to query-relevant chunks (smaller,
 *  faster, more relevant). */
export async function tavilyExtract(
  urls: string[],
  query?: string,
): Promise<{ url: string; title: string; text: string }[]> {
  if (urls.length === 0) return [];
  tavilyUsage.extractedUrls += urls.length;
  const data = await post<TavilyExtractResponse>('/extract', {
    urls,
    extract_depth: 'advanced',
    include_usage: true,
    ...(query ? { query } : {}),
  });
  // Real credits from the API; fall back to the validated ~0.4/URL rate.
  tavilyUsage.extractCredits += data.usage?.credits ?? urls.length * 0.4;
  return data.results
    .filter((r) => r.raw_content && r.raw_content.trim().length > 200)
    .map((r) => ({
      url: r.url,
      title: r.title ?? r.url,
      text: r.raw_content,
    }));
}
