# DOWOracle Roadmap — v2 & Future Improvements

Things deliberately deferred from v1. Not blockers — revisit after the hackathon
or when a real user need appears.

## Report & Intelligence
- **Match report language to query language** — Indonesian query currently yields
  an English report (planner translates queries to English for better search).
  Add "respond in the query's language" to the analyst prompt. Not urgent:
  hackathon judges read English.
- **Output length toggle** (short / standard / long) — reports are currently
  fixed (max 6 catalysts, 6 risks). Nice-to-have UX, not a v1 need.
- **Multi-topic comparison view** — side-by-side reports (e.g. ETH vs SOL).
  The CLI handles comparison topics in one report today; a dedicated UI
  could be stronger.
- **Planner absolute-date nit** — the planner occasionally slips a year
  ("2024") into queries despite the relative-dates rule. Harmless (results
  still good), fix opportunistically.

## Sources & Power-User Controls
- **`--include-domains` flag / UI option** — let power users nudge the agent
  toward specific domains (e.g. official sources only). Tavily supports it;
  we hardcode excludes today.
- **Tavily Crawl integration** — depth-first crawling of a single site
  (docs, official blogs). Our pipeline is breadth-first by design; crawl
  only makes sense as an opt-in "deep mode".
- **Basic vs Advanced Tavily toggle** — advanced costs 2× credits. Keep
  advanced default (quality > cost for now); add the toggle only if credit
  burn ever becomes a real constraint.

## Platform
- **Telegram alerts** (phase 2 in the original brief) — push finished reports
  to Telegram. Needs a bot + user opt-in flow.
- **Auth + cloud history** — v1 history is localStorage. Real accounts +
  server-side history if the product outlives the hackathon.
- **LangSmith tracing** — $100 observability credit claimed, unused.
  Wire traces for eval/debugging when iterating on prompts.

## Cost
- **Analyst context diet** — the Ultra analyst call is ~90% of per-report
  cost. If costs ever bite, trim summaries sent to the analyst first
  (quality tradeoff — measure before cutting).
