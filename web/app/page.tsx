"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProgressEvent, SignalReport } from "../../src/agent/types.js";
import { ResearchFeed } from "../components/ResearchFeed.js";
import { ReportView } from "../components/ReportView.js";
import { loadHistory, saveToHistory, type HistoryEntry } from "../components/HistoryDrawer.js";
import { OracleMark, ScrollIcon, SparkIcon, PanelIcon } from "../components/icons.js";

type Status = "idle" | "researching" | "report" | "error";

const EXAMPLES = [
  "What is heating up in the Monad ecosystem?",
  "Aptos network upgrades and ecosystem growth this year",
  "Is Pi Network a scam?",
  "Latest progress in solid-state batteries this year",
];

/** The pipeline's final done-message carries timing + cost; trim the lead-in. */
function cleanMeta(message: string): string {
  return message
    .replace(/^Report ready — score \d+\/100 \(\w+\)\.\s*/, "")
    .replace(/⏱️/g, "")
    .replace(/💰/g, "")
    .trim();
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [topic, setTopic] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [report, setReport] = useState<SignalReport | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sideOpen, setSideOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  /** Auto-grow the textarea as the user types. */
  const autosize = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  };

  const run = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query || abortRef.current) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setActiveTopic(query);
    setActiveId(null);
    setEvents([]);
    setReport(null);
    setMeta(null);
    setError(null);
    setStatus("researching");
    setSideOpen(false);

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
          setActiveId(entry.id);
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
    setActiveId(h.id);
    setStatus("report");
    setSideOpen(false);
    window.scrollTo({ top: 0 });
  };

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setTopic("");
    setActiveId(null);
    setReport(null);
    setEvents([]);
    setError(null);
    requestAnimationFrame(autosize);
  };

  const onAreaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      run(topic);
    }
  };

  return (
    <div className="shell">
      <div className="bg" aria-hidden />

      <aside className={`sidebar${sideOpen ? " open" : ""}${collapsed ? " collapsed" : ""}`}>
        <div className="side-top">
          <div className="wordmark collapse-hide">
            <OracleMark className="mark" />
            DOWOracle
            <span className="suffix">/readings</span>
          </div>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand panel" : "Minimize panel"}
            title={collapsed ? "Expand" : "Minimize"}
          >
            <PanelIcon />
          </button>
          <button className="side-close" onClick={() => setSideOpen(false)} aria-label="close menu">
            ×
          </button>
        </div>

        <button className="new-btn" onClick={() => { reset(); setSideOpen(false); }}>
          <span aria-hidden className="new-plus">+</span>
          <span className="collapse-hide">New reading</span>
        </button>

        <div className="rail-only" aria-hidden={!collapsed}>
          <button className="rail-btn" onClick={() => setCollapsed(false)} aria-label="Expand panel" title="Expand">
            <PanelIcon />
          </button>
        </div>

        <div className="side-label collapse-hide">History</div>
        <div className="side-history collapse-hide">
          {history.length === 0 ? (
            <div className="side-empty">
              <ScrollIcon />
              <span>
                No readings yet.
                <br />
                Ask the oracle anything.
              </span>
            </div>
          ) : (
            history.map((h) => (
              <button
                key={h.id}
                className={`hist-row${h.id === activeId ? " active" : ""}`}
                onClick={() => openHistory(h)}
              >
                <div className="h-topic">{h.topic}</div>
                <div className="h-meta">
                  <span className={`hist-score ${h.verdict.toLowerCase()}`}>
                    {h.score}
                  </span>
                  <span className="tnum">{formatWhen(h.generatedAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="side-foot collapse-hide">
          Nemotron on Nebius · grounded with Tavily
          <br />
          Best Apps &amp; Agents · Best Use of Tavily
        </div>
      </aside>
      <div
        className={`scrim${sideOpen ? " show" : ""}`}
        onClick={() => setSideOpen(false)}
      />

      <main className="main">
        <div className="mobilebar">
          <button className="menu-btn" onClick={() => setSideOpen(true)}>
            ☰ Readings
          </button>
          <div className="wordmark">
            <OracleMark className="mark" />
            DOWOracle
          </div>
          <button className="menu-btn" onClick={reset}>
            + New
          </button>
        </div>

        <div className={`center-col${status === "idle" ? "" : " wide"}`}>
          {status === "idle" && (
            <>
              <div className="brand-lockup">
                <OracleMark className="mark" />
                DOWOracle <span className="suffix">/readings</span>
              </div>
              <h1 className="hero-h">
                Ask the <span className="hl">oracle</span> anything.
              </h1>
              <p className="hero-sub">
                Fresh searches across news, forums and threads — distilled
                into a signal report: score, verdict, catalysts, risk flags.
              </p>

              <form className="query-card glass" onSubmit={submit}>
                <textarea
                  ref={areaRef}
                  className="query-area"
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    autosize();
                  }}
                  onKeyDown={onAreaKey}
                  placeholder="What is heating up in the Monad ecosystem?"
                  aria-label="research topic"
                  rows={3}
                  autoFocus
                />
                <div className="query-bar">
                  <span className="query-meta tnum">~30s · ~$0.11 per reading</span>
                  <button className="send-btn" type="submit" disabled={!topic.trim()}>
                    Consult <span aria-hidden>↑</span>
                  </button>
                </div>
              </form>

              <div className="examples">
                <div className="examples-label">
                  <SparkIcon />
                  Try an example
                </div>
                <div className="chips">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} className="chip" onClick={() => run(ex)}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="how-strip">
                <span><b>Plan</b> → fresh queries</span>
                <span><b>Search</b> → Tavily</span>
                <span><b>Extract</b> → full text</span>
                <span><b>Analyze</b> → Nemotron Ultra</span>
                <span><b>Score</b> → 0–100</span>
              </div>
            </>
          )}

          {status === "researching" && (
            <>
              <div className="research-head">
                <div className="label">
                  <span className="dot" style={{ background: "var(--accent)", opacity: 1, animation: "pulse 1.1s ease-in-out infinite" }} />
                  Consulting the oracle
                </div>
                <h1>{activeTopic}</h1>
              </div>
              <ResearchFeed events={events} />
            </>
          )}

          {status === "report" && report && (
            <div className="report-card glass">
              <ReportView report={report} meta={meta} onNew={reset} />
            </div>
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
        </div>
      </main>
    </div>
  );
}
