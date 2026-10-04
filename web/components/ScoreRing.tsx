"use client";

import { useEffect, useRef, useState } from "react";
import type { Verdict } from "../../src/agent/types.js";

const COLORS: Record<Verdict, string> = {
  bullish: "#0d8a5f",
  bearish: "#d92d5c",
  neutral: "#78716c",
};

/** Radial score ring — the hero element of a report. Counts up on mount. */
export function ScoreRing({ score, verdict }: { score: number; verdict: Verdict }) {
  const [shown, setShown] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(eased * score));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [score]);

  const r = 104;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, shown / 100));
  const color = COLORS[verdict];

  return (
    <div className="ring-wrap">
      <svg className="ring-svg" viewBox="0 0 240 240" role="img" aria-label={`score ${score} of 100`}>
        <circle className="ring-bg" cx="120" cy="120" r={r} fill="none" strokeWidth="11" />
        <circle
          className="ring-fg"
          cx="120"
          cy="120"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-score tnum">{shown}</div>
        <div className="ring-den">/ 100</div>
      </div>
    </div>
  );
}
