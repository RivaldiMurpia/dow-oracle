// The 6-stage research pipeline:
// plan -> search -> dedupe -> extract -> summarize -> analyze

import { z } from 'zod';
import { tavilySearch, tavilyExtract } from '../tavily.js';
import { chatJson, reasoningModel, fastModel } from '../nebius.js';
import { PLANNER_SYSTEM, SUMMARIZER_SYSTEM, ANALYST_SYSTEM } from './prompts.js';
import type {
  ExtractedSource,
  PlannedQuery,
  ProgressEvent,
  ProgressStage,
  SignalReport,
  SourceSummary,
} from './types.js';

const SPAM_DOMAINS = [
  'pump.fun',
  'coingecko.com', // almost every indexed page is a price tracker
  // add more as encountered
];

// URL path patterns that almost always mean price/speculation pages,
// not real ecosystem intel. Applied after domain filtering because
// aggregators (e.g. coinmarketcap.com) also host real news sections.
const JUNK_URL_PATTERNS = [
  /\/price/i,
  /price-prediction/i,
  /\/coins\//i,
  /\/currencies\//i,
  /\/converter\//i,
  /\/charts?\//i,
  /price-today/i,
];

function isJunkUrl(url: string): boolean {
  return JUNK_URL_PATTERNS.some((re) => re.test(url));
}

// Domains that rarely yield readable article text via extraction
// (video pages, JS-walled social, login walls). Filtered before extract
// so we don't waste summarizer calls on site chrome.
const EXTRACT_HOSTILE_DOMAINS = [
  'x.com',
  'twitter.com',
  'youtube.com',
  'youtu.be',
  'linkedin.com',
  'instagram.com',
  'tiktok.com',
  'facebook.com',
];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function isExtractHostile(url: string): boolean {
  const host = hostnameOf(url);
  return EXTRACT_HOSTILE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Heuristic substance check: real article text has multiple proper
 * sentences. Nav menus, cookie banners, and template chrome don't.
 */
function hasSubstance(text: string): boolean {
  const sentences = text
    .split(/[.!?…]+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 5);
  return text.length >= 500 && sentences.length >= 3;
}

const MAX_SOURCES = 10;

const PlannedQueriesSchema = z.object({
  queries: z
    .array(z.object({ query: z.string(), timeRange: z.enum(['day', 'week', 'month']) }))
    .min(1)
    .max(6),
});

const SummarySchema = z.object({
  summary: z.string(),
  keyClaims: z.array(z.string()),
});

const AnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.enum(['bullish', 'bearish', 'neutral']),
  verdictSummary: z.string(),
  catalysts: z.array(z.string()),
  risks: z.array(
    z.object({
      label: z.string(),
      detail: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
    }),
  ),
});

export type ProgressHandler = (e: ProgressEvent) => void;

/**
 * A planned query is junk if it's too short or has no alphanumeric
 * substance (e.g. "...", "???", "-"). Models occasionally emit
 * placeholders that pass shape validation but Tavily rejects (400).
 */
function isJunkQuery(q: string): boolean {
  const t = q.trim();
  return t.length < 12 || !/[a-z0-9]{4,}/i.test(t);
}

/**
 * Deterministic fallback when the planner model misbehaves.
 * Mirrors the prompt's coverage (news, announcements, sentiment, risks)
 * so the pipeline never dies at step 1.
 */
function fallbackQueries(topic: string): PlannedQuery[] {
  const t = topic.trim().replace(/\?+$/, '');
  return [
    { query: `${t} latest news developments this week`, timeRange: 'week' },
    { query: `${t} announcements partnerships launches`, timeRange: 'month' },
    { query: `${t} community discussion sentiment`, timeRange: 'week' },
    { query: `${t} risks criticism security concerns`, timeRange: 'month' },
  ];
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const norm = u.replace(/\/$/, '').toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(u);
    }
  }
  return out;
}

export async function runResearch(
  topic: string,
  onProgress: ProgressHandler = () => {},
): Promise<SignalReport> {
  const emit = (stage: ProgressStage, message: string) =>
    onProgress({ stage, message });
  const debug = process.env.DOWORACLE_DEBUG === '1';

  // Per-stage timing so slow runs can be diagnosed instead of guessed.
  const startedAt = Date.now();
  let lastMark = startedAt;
  const timing: [string, number][] = [];
  const mark = (label: string) => {
    const now = Date.now();
    timing.push([label, Math.round((now - lastMark) / 1000)]);
    lastMark = now;
  };

  // 1. Plan (retry on junk; deterministic fallback as last resort)
  emit('planning', 'Planning search queries…');
  let planned: { queries: PlannedQuery[] } | null = null;
  for (let attempt = 0; attempt < 3 && !planned; attempt++) {
    const candidate = await chatJson(
      fastModel(),
      PLANNER_SYSTEM,
      `Topic: ${topic}`,
      PlannedQueriesSchema,
    );
    const junk = candidate.queries.filter((q) => isJunkQuery(q.query));
    const valid = candidate.queries.filter((q) => !isJunkQuery(q.query));
    if (junk.length > 0) {
      emit(
        'planning',
        `Rejected ${junk.length} junk queries: ${junk
          .map((q) => `"${q.query.slice(0, 50)}"`)
          .join(', ')}`,
      );
    }
    if (valid.length > 0) {
      planned = { queries: valid };
    } else if (attempt < 2) {
      emit('planning', `Planner returned only junk, retrying (${attempt + 1}/3)…`);
    }
  }
  if (!planned) {
    emit('planning', 'Planner failed 3x — using fallback query templates.');
    planned = { queries: fallbackQueries(topic) };
  }
  mark('planning');
  emit(
    'planning',
    `Planned ${planned.queries.length} queries: ${planned.queries
      .map((q: PlannedQuery) => `"${q.query}"`)
      .join(', ')}`,
  );

  // 2. Search
  emit('searching', 'Searching the web…');
  const hits = (
    await Promise.all(
      planned.queries.map((q: PlannedQuery) =>
        tavilySearch(q.query, {
          maxResults: 8,
          timeRange: q.timeRange,
          excludeDomains: SPAM_DOMAINS,
        }).catch((err) => {
          emit('searching', `Query failed, skipping: ${q.query} (${err})`);
          return [];
        }),
      ),
    )
  ).flat();
  const deduped = dedupeUrls(hits.map((h) => h.url));
  const junkCount = deduped.filter(isJunkUrl).length;
  const hostileCount = deduped.filter(
    (u) => !isJunkUrl(u) && isExtractHostile(u),
  ).length;
  const urls = deduped
    .filter((u) => !isJunkUrl(u) && !isExtractHostile(u))
    .slice(0, MAX_SOURCES);
  emit(
    'searching',
    `Found ${hits.length} hits, ${deduped.length} unique, ` +
      `filtered ${junkCount} price pages + ${hostileCount} video/social pages, ` +
      `keeping ${urls.length} sources.`,
  );

  if (urls.length === 0) {
    throw new Error('No sources found — try a different topic.');
  }
  mark('searching');

  // 3. Extract (scoped to the topic: smaller payloads, faster, more relevant)
  emit('extracting', `Extracting full text from ${urls.length} sources…`);
  const extractedRaw = await tavilyExtract(urls, topic);
  // Drop thin/chrome content before paying for summarization.
  const extracted: ExtractedSource[] = [];
  let droppedThin = 0;
  for (const src of extractedRaw) {
    if (debug) {
      const preview = src.text.slice(0, 200).replace(/\s+/g, ' ');
      emit('extracting', `${src.url} → ${src.text.length} chars | ${preview}…`);
    }
    if (hasSubstance(src.text)) {
      extracted.push(src);
    } else {
      droppedThin++;
      emit('extracting', `Dropped (thin content): ${src.url}`);
    }
  }
  emit(
    'extracting',
    `Extracted ${extracted.length} substantive articles (${droppedThin} thin).`,
  );
  mark('extracting');

  if (extracted.length === 0) {
    throw new Error('Could not extract readable content from any source.');
  }

  // 4. Summarize (fast model, in parallel)
  emit('summarizing', 'Summarizing sources…');
  const summaries: SourceSummary[] = [];
  let droppedIrrelevant = 0;
  let droppedFailed = 0;
  const settled = await Promise.allSettled(
    extracted.map(async (src) => {
      const parsed = await chatJson(
        fastModel(),
        SUMMARIZER_SYSTEM,
        `RESEARCH TOPIC: ${topic}\nURL: ${src.url}\nTITLE: ${src.title}\n\n${src.text.slice(0, 12000)}`,
        SummarySchema,
      );
      return { url: src.url, title: src.title, ...parsed };
    }),
  );
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    const src = extracted[i];
    if (s.status === 'fulfilled' && s.value.keyClaims.length > 0) {
      summaries.push(s.value);
      if (debug) {
        const claims = s.value.keyClaims
          .slice(0, 3)
          .map((c) => c.slice(0, 110))
          .join(' | ');
        emit('summarizing', `✓ ${src.url}\n  → ${claims}`);
      }
    } else if (s.status === 'fulfilled') {
      droppedIrrelevant++;
      emit('summarizing', `Dropped (irrelevant): ${src.url}`);
    } else {
      droppedFailed++;
      emit('summarizing', `Dropped (summarizer error): ${src.url}`);
    }
  }
  emit(
    'summarizing',
    `Summarized ${summaries.length} sources (${droppedIrrelevant} irrelevant, ${droppedFailed} failed).`,
  );
  mark('summarizing');

  if (summaries.length === 0) {
    throw new Error('No usable source summaries — try a different topic.');
  }

  // 5. Analyze (reasoning model, once)
  emit('analyzing', 'Analyzing with the reasoning model…');
  if (debug) {
    for (const s of summaries) {
      emit(
        'analyzing',
        `SUMMARY ${s.url}\n  ${s.summary.slice(0, 250)}\n  claims: ${s.keyClaims.join(' | ').slice(0, 900)}`,
      );
    }
  }
  const analystInput = summaries
    .map(
      (s, i) =>
        `SOURCE ${i + 1} (${s.url})\nTITLE: ${s.title}\nSUMMARY: ${s.summary}\nKEY CLAIMS:\n${s.keyClaims.map((c) => `- ${c}`).join('\n')}`,
    )
    .join('\n\n---\n\n');
  const analysis = await chatJson(
    reasoningModel(),
    ANALYST_SYSTEM,
    `TOPIC: ${topic}\n\n${analystInput}`,
    AnalysisSchema,
    { maxTokens: 3000 },
  );

  // 6. Assemble
  const report: SignalReport = {
    topic,
    score: Math.round(analysis.score),
    verdict: analysis.verdict,
    verdictSummary: analysis.verdictSummary,
    catalysts: analysis.catalysts,
    risks: analysis.risks,
    sources: summaries.map((s) => ({ url: s.url, title: s.title })),
    generatedAt: new Date().toISOString(),
  };
  mark('analyzing');
  const totalSec = Math.round((Date.now() - startedAt) / 1000);
  const timingStr = timing.map(([l, s]) => `${l} ${s}s`).join(' · ');
  emit(
    'done',
    `Report ready — score ${report.score}/100 (${report.verdict}). ⏱️ ${timingStr} · total ${totalSec}s`,
  );
  return report;
}

/** Render a report as Markdown (for CLI output and later reuse in the UI). */
export function reportToMarkdown(r: SignalReport): string {
  const lines = [
    `# DOWOracle Signal Report`,
    ``,
    `**Topic:** ${r.topic}`,
    `**Score:** ${r.score}/100 — ${r.verdict.toUpperCase()}`,
    `**Generated:** ${r.generatedAt}`,
    ``,
    `> ${r.verdictSummary}`,
    ``,
    `## Catalysts`,
    ...r.catalysts.map((c) => `- ${c}`),
    ``,
    `## Risk flags`,
    ...(r.risks.length === 0
      ? ['- None found.']
      : r.risks.map((f) => `- [${f.severity.toUpperCase()}] **${f.label}** — ${f.detail}`)),
    ``,
    `## Sources`,
    ...r.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`),
    ``,
    `_Generated by DOWOracle — NVIDIA Nemotron on Nebius Token Factory, grounded with Tavily._`,
  ];
  return lines.join('\n');
}
