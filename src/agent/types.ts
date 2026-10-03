// Shared types for the DOWOracle research pipeline.

export interface PlannedQuery {
  query: string;
  /** Freshness window for this query */
  timeRange: 'day' | 'week' | 'month';
}

export interface SearchHit {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface ExtractedSource {
  url: string;
  title: string;
  text: string;
}

export interface SourceSummary {
  url: string;
  title: string;
  summary: string;
  keyClaims: string[];
}

export type Verdict = 'bullish' | 'bearish' | 'neutral';

export interface RiskFlag {
  label: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SignalReport {
  topic: string;
  /** 0-100. Higher = stronger positive signal for the topic. */
  score: number;
  verdict: Verdict;
  verdictSummary: string;
  catalysts: string[];
  risks: RiskFlag[];
  sources: { url: string; title: string }[];
  generatedAt: string;
}

export type ProgressStage =
  | 'planning'
  | 'searching'
  | 'extracting'
  | 'summarizing'
  | 'analyzing'
  | 'done';

export interface ProgressEvent {
  stage: ProgressStage;
  message: string;
}
