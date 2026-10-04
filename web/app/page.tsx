"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProgressEvent, SignalReport } from "../../src/agent/types.js";
import { ResearchFeed } from "../components/ResearchFeed.js";
import { ReportView } from "../components/ReportView.js";
import {
  HistoryDrawer,
  loadHistory,
  saveToHistory,
  type HistoryEntry,
} from "../components/HistoryDrawer.js";
import { OracleMark, ScrollIcon } from "../components/icons.js";

type Status = "idle" | "researching" | "report" | "error";

const EXAMPLES = [
  "What is heating up in the Monad ecosystem?",
  "Aptos network upgrades and ecosystem growth this year",
  "Is Pi Network a scam?",
  "Latest progress in solid-state batteries this year",
];

const HOW_IT_WORKS: [string, string, string][] = [
  ["01", "Plan", "3–5 fresh queries"],
  ["02", "Search", "Tavily, time-bounded"],
  ["03", "Extract", "full article text"],
  ["04", "Summarize", "parallel, per source"],
  ["05", "Analyze", "Nemotron-3-Ultra"],
  ["06", "Score", "0–100 + risk flags"],
];

/** The pipeline's final done-message carries timing + cost; trim the lead-in. */
function cleanMeta(message: string): string {
  return message
    .replace(/^Report ready — score \d+\/100 \(\w+\)\.\s*/, "")
    .replace(/⏱️/g, "")
    .replace(/💰/g, "")
    .trim();
}

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [topic, setTopic] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [report, setReport] = useState<SignalReport | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const run = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query || abortRef.current) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setActiveTopic(query);
    setEvents([]);
    setReport(null);
    setMeta(null);
    setError(null);
    setStatus("researching");

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: query }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`research request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let doneMsg: string | null = null;
      let terminal = false;

      const handle = (event: string, data: unknown) => {
        if (event === "progress") {
          const e = data as ProgressEvent;
          setEvents((prev) => [...prev, e]);
          if (e.stage === "done") doneMsg = e.message;
        } else if (event === "report") {
          const r = data as SignalReport;
          terminal = true;
          const m = doneMsg ? cleanMeta(doneMsg) : null;
          setReport(r);
          setMeta(m);
          const entry: HistoryEntry = {
            id: `${Date.now()}`,
            topic: r.topic,
            score: r.score,
            verdict: r.verdict,
            generatedAt: r.generatedAt,
            report: r,
            meta: m,
          };
          saveToHistory(entry);
          setHistory(loadHistory());
          setStatus("report");
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (event === "error") {
          terminal = true;
          throw new Error((data as { message: string }).message || "research failed");
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let event = "message";
          let dataStr = "";
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (dataStr) handle(event, JSON.parse(dataStr));
        }
      }
      if (!terminal && !ctrl.signal.aborted) {
        throw new Error("Connection closed before the reading completed.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(topic);
  };

  const openHistory = (h: HistoryEntry) => {
    setReport(h.report);
    setMeta(h.meta);
    setActiveTopic(h.topic);
    setStatus("report");
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
  };

  const reset = () => {
    setStatus("idle");
    setTopic("");
    setReport(null);
    setEvents([]);
    setError(null);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wordmark">
          <OracleMark className="mark" style={{ color: "var(--accent)" }} />
          DOWOracle
        </div>
        <div className="topbar-right">
          <span className="hide-sm">Nemotron on Nebius · grounded with Tavily</span>
          <button className="history-toggle" onClick={() => setDrawerOpen(true)}>
            <ScrollIcon />
            Readings
            <span className="count tnum">{history.length}</span>
          </button>
        </div>
      </header>

      <main className="main">
        {status === "idle" && (
          <div className="hero">
            <div>
              <div className="hero-kicker">Crypto research agent</div>
              <h1>
                Ask the oracle <em>anything.</em>
              </h1>
              <p className="hero-sub">
                It plans fresh searches, digs through news, forums and
                threads, then returns a signal report — score, verdict,
                catalysts, risk flags — every claim cited.
              </p>
              <form className="query-form" onSubmit={submit}>
                <input
                  className="query-input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What is heating up in the Monad ecosystem?"
                  aria-label="research topic"
                  autoFocus
                />
                <button className="query-submit" type="submit" disabled={!topic.trim()}>
                  <span className="lbl">Consult</span>
                  <span aria-hidden>→</span>
                </button>
              </form>
              <div className="chips">
                {EXAMPLES.map((ex) => (
                  <button key={ex} className="chip" onClick={() => run(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
            <aside className="hero-side">
              <h2>How a reading works</h2>
              <ul className="stage-list">
                {HOW_IT_WORKS.map(([n, name, detail]) => (
                  <li key={n}>
                    <span className="n tnum">{n}</span>
                    <span>{name}</span>
                    <span className="d">{detail}</span>
                  </li>
                ))}
              </ul>
              <div className="hero-stats">
                <div className="stat">
                  <b className="tnum">~30s</b>
                  <span>per reading</span>
                </div>
                <div className="stat">
                  <b className="tnum">~$0.11</b>
                  <span>per reading</span>
                </div>
                <div className="stat">
                  <b className="tnum">0–100</b>
                  <span>signal score</span>
                </div>
              </div>
            </aside>
          </div>
        )}

        {status === "researching" && (
          <div>
            <div className="research-head">
              <div className="label">Consulting the oracle</div>
              <h1>{activeTopic}</h1>
            </div>
            <ResearchFeed events={events} />
          </div>
        )}

        {status === "report" && report && (
          <ReportView report={report} meta={meta} onNew={reset} />
        )}

        {status === "error" && (
          <div className="error-card">
            <h2>The oracle falters</h2>
            <p>{error ?? "Unknown error"}</p>
            <button className="new-reading" onClick={reset}>
              Try again
            </button>
          </div>
        )}
      </main>

      <footer className="foot">
        <span>DOWOracle — NVIDIA Nemotron on Nebius Token Factory</span>
        <span className="tnum">Best Apps &amp; Agents · Best Use of Tavily</span>
      </footer>

      {drawerOpen && (
        <HistoryDrawer
          entries={history}
          onSelect={openHistory}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
