"use client";

import type { SignalReport } from "../../src/agent/types.js";
import { ScoreRing } from "./ScoreRing.js";
import { ArrowLeftIcon, ArrowUpRightIcon, BoltIcon, LinkIcon, ShieldIcon } from "./icons.js";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * The signal report: score ring + verdict on the left, catalysts /
 * risk flags / sources on the right. `meta` is the pipeline's final
 * done-message (timing + token/cost summary).
 */
export function ReportView({
  report,
  meta,
  onNew,
}: {
  report: SignalReport;
  meta: string | null;
  onNew: () => void;
}) {
  return (
    <div>
      <div className="report-head">
        <div className="label">
          <span>Signal report</span>
        </div>
        <h1>{report.topic}</h1>
        <div className="when tnum">generated {formatWhen(report.generatedAt)}</div>
      </div>

      <div className="report-grid">
        <div className="score-block">
          <div>
            <ScoreRing score={report.score} verdict={report.verdict} />
            <div>
              <span className={`verdict-badge ${report.verdict}`}>
                <span className="vdot" />
                {report.verdict}
              </span>
            </div>
          </div>
          <div style={{ width: "100%" }}>
            <div className="meta-list">
              <div className="row">
                <span className="k">Sources read</span>
                <span className="v tnum">{report.sources.length}</span>
              </div>
              <div className="row">
                <span className="k">Catalysts</span>
                <span className="v tnum">{report.catalysts.length}</span>
              </div>
              <div className="row">
                <span className="k">Risk flags</span>
                <span className="v tnum">{report.risks.length}</span>
              </div>
              {meta ? (
                <div className="row">
                  <span className="k">Run stats</span>
                  <span className="v">{meta}</span>
                </div>
              ) : null}
            </div>
            <button className="new-reading" onClick={onNew}>
              <ArrowLeftIcon />
              New reading
            </button>
          </div>
        </div>

        <div className="report-body">
          <section>
            <div className="sec-label">Verdict</div>
            <p className="verdict-text">{report.verdictSummary}</p>
          </section>

          <section>
            <div className="sec-label">
              <BoltIcon />
              Catalysts · {report.catalysts.length}
            </div>
            {report.catalysts.length === 0 ? (
              <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
                None identified in the sources.
              </p>
            ) : (
              <ul className="catalyst-list">
                {report.catalysts.map((c, i) => (
                  <li key={i}>
                    <span className="n tnum">{String(i + 1).padStart(2, "0")}</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="sec-label">
              <ShieldIcon />
              Risk flags · {report.risks.length}
            </div>
            {report.risks.length === 0 ? (
              <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
                None found.
              </p>
            ) : (
              <ul className="risk-list">
                {report.risks.map((r, i) => (
                  <li key={i}>
                    <div className="risk-head">
                      <span className={`sev ${r.severity}`}>{r.severity}</span>
                      <span className="risk-label">{r.label}</span>
                    </div>
                    <p className="risk-detail">{r.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="sec-label">
              <LinkIcon />
              Sources · {report.sources.length}
            </div>
            <ol className="source-list">
              {report.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    <span className="n tnum">{String(i + 1).padStart(2, "0")}</span>
                    <span className="src-title">{s.title}</span>
                    <span className="src-host">{hostOf(s.url)}</span>
                    <ArrowUpRightIcon />
                  </a>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
