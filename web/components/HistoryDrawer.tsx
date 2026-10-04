"use client";

import type { SignalReport } from "../../src/agent/types.js";
import { CloseIcon } from "./icons.js";

export interface HistoryEntry {
  id: string;
  topic: string;
  score: number;
  verdict: SignalReport["verdict"];
  generatedAt: string;
  report: SignalReport;
  meta: string | null;
}

const KEY = "doworacle:readings";

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveToHistory(entry: HistoryEntry) {
  try {
    const prev = loadHistory().filter((h) => h.id !== entry.id);
    localStorage.setItem(KEY, JSON.stringify([entry, ...prev].slice(0, 24)));
  } catch {
    /* storage unavailable — history is best-effort */
  }
}

export function HistoryDrawer({
  entries,
  onSelect,
  onClose,
}: {
  entries: HistoryEntry[];
  onSelect: (e: HistoryEntry) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="past readings">
        <div className="drawer-head">
          <h2>Past readings</h2>
          <button className="drawer-close" onClick={onClose} aria-label="close history">
            <CloseIcon />
          </button>
        </div>
        <div className="drawer-list">
          {entries.length === 0 ? (
            <p className="drawer-empty">
              No readings yet. Ask the oracle something.
            </p>
          ) : (
            entries.map((h) => (
              <button
                key={h.id}
                className="hist-item"
                onClick={() => onSelect(h)}
              >
                <div className="h-topic">{h.topic}</div>
                <div className="h-meta tnum">
                  <span className={`hist-score ${h.verdict}`}>{h.score}/100</span>
                  <span>{h.verdict}</span>
                  <span>{new Date(h.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
