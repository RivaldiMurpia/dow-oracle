"use client";

import { useEffect, useRef } from "react";
import type { ProgressEvent } from "../../src/agent/types.js";

const STAGES = [
  "planning",
  "searching",
  "extracting",
  "summarizing",
  "analyzing",
  "report",
] as const;

type StageName = (typeof STAGES)[number];

const STAGE_BLURB: Record<StageName, string> = {
  planning: "nemotron-3.5",
  searching: "tavily search",
  extracting: "tavily extract",
  summarizing: "nemotron-3.5",
  analyzing: "nemotron-3-ultra",
  report: "signal",
};

export type StageState = "pending" | "active" | "done";

/** Derive per-stage state from the stream of progress events. */
export function stageStates(events: ProgressEvent[]): Record<StageName, StageState> {
  const out = {} as Record<StageName, StageState>;
  let highest = -1;
  for (const e of events) {
    const i =
      e.stage === "done"
        ? STAGES.length - 1
        : (STAGES as readonly string[]).indexOf(e.stage);
    if (i > highest) highest = i;
  }
  STAGES.forEach((s, i) => {
    out[s] = i < highest ? "done" : i === highest ? "active" : "pending";
  });
  return out;
}

/** Live stage tracker + mono log feed while the pipeline runs. */
export function ResearchFeed({ events }: { events: ProgressEvent[] }) {
  const states = stageStates(events);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div>
      <div className="stage-tracker" role="status" aria-label="research progress">
        {STAGES.map((s, i) => (
          <div key={s} className={`stage-cell ${states[s]}`}>
            <div className="s-name">
              <span className="dot" />
              {s}
            </div>
            <div className="s-time tnum">{STAGE_BLURB[s]}</div>
          </div>
        ))}
      </div>
      <div className="log-feed" ref={feedRef} aria-live="polite">
        {events.map((e, i) => (
          <div
            key={i}
            className={`log-line${i === events.length - 1 ? " latest" : ""}`}
          >
            <span className="tag">{e.stage}</span>
            <span>{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
