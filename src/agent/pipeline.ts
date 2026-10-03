// The 6-stage research pipeline:
// plan -> search -> dedupe -> extract -> summarize -> analyze

import { z } from 'zod';
import { tavilySearch, tavilyExtract } from '../tavily.js';
import { chat, extractJson, reasoningModel, fastModel } from '../nebius.js';
import { PLANNER_SYSTEM, SUMMARIZER_SYSTEM, ANALYST_SYSTEM } from './prompts.js';
import type {
  PlannedQuery,
  ProgressEvent,
  ProgressStage,
  SignalReport,
  SourceSummary,
} from './types.js';

const SPAM_DOMAINS = [
  'pump.fun',
  // add more as encountered
];

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

  // 1. Plan
  emit('planning', 'Planning search queries…');
  const planRaw = await chat(fastModel(), PLANNER_SYSTEM, `Topic: ${topic}`);
  const planned = PlannedQueriesSchema.parse(extractJson(planRaw));
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
  const urls = dedupeUrls(hits.map((h) => h.url)).slice(0, MAX_SOURCES);
  emit('searching', `Found ${hits.length} hits, keeping ${urls.length} unique sources.`);

  if (urls.length === 0) {
    throw new Error('No sources found — try a different topic.');
  }

  // 3. Extract
  emit('extracting', `Extracting full text from ${urls.length} sources…`);
  const extracted = await tavilyExtract(urls);
  emit('extracting', `Extracted ${extracted.length} readable articles.`);

  if (extracted.length === 0) {
    throw new Error('Could not extract readable content from any source.');
  }

  // 4. Summarize (fast model, in parallel)
  emit('summarizing', 'Summarizing sources…');
  const summaries: SourceSummary[] = [];
  const settled = await Promise.allSettled(
    extracted.map(async (src) => {
      const raw = await chat(
        fastModel(),
        SUMMARIZER_SYSTEM,
        `URL: ${src.url}\nTITLE: ${src.title}\n\n${src.text.slice(0, 12000)}`,
      );
      const parsed = SummarySchema.parse(extractJson(raw));
      return { url: src.url, title: src.title, ...parsed };
    }),
  );
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.keyClaims.length > 0) {
      summaries.push(s.value);
    }
  }
  emit('summarizing', `Summarized ${summaries.length} sources.`);

  if (summaries.length === 0) {
    throw new Error('No usable source summaries — try a different topic.');
  }

  // 5. Analyze (reasoning model, once)
  emit('analyzing', 'Analyzing with the reasoning model…');
  const analystInput = summaries
    .map(
      (s, i) =>
        `SOURCE ${i + 1} (${s.url})\nTITLE: ${s.title}\nSUMMARY: ${s.summary}\nKEY CLAIMS:\n${s.keyClaims.map((c) => `- ${c}`).join('\n')}`,
    )
    .join('\n\n---\n\n');
  const analysisRaw = await chat(
    reasoningModel(),
    ANALYST_SYSTEM,
    `TOPIC: ${topic}\n\n${analystInput}`,
    { maxTokens: 3000 },
  );
  const analysis = AnalysisSchema.parse(extractJson(analysisRaw));

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
  emit('done', `Report ready — score ${report.score}/100 (${report.verdict}).`);
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
