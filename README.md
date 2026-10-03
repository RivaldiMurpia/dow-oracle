# DOWOracle

AI crypto research agent — built for the **Nebius x NVIDIA Global AI Hackathon** (Devpost).

Give it a topic, it goes into the field: plans searches, digs through fresh news/forums/threads via **Tavily**, then synthesizes everything into a **signal report** — 0–100 score, bull/bear breakdown, key catalysts, risk flags — all with clickable citations. Powered by **NVIDIA Nemotron** models on **Nebius Token Factory**.

Track: **Best Apps and Agents** (+ targeting the **Best Use of Tavily** $3K prize).

## Quick start

```bash
npm install
cp .env.example .env
# fill in NEBIUS_* and TAVILY_API_KEY (see .env.example)
npm run research -- "what is heating up in the Monad ecosystem?"
```

## Project structure

```
src/
  cli.ts              # CLI entry — runs a research job, prints Markdown report
  tavily.ts           # Tavily Search + Extract wrappers
  nebius.ts           # Nebius Token Factory client (OpenAI-compatible) + JSON recovery
  agent/
    types.ts          # shared pipeline types
    prompts.ts        # planner / summarizer / analyst prompts
    pipeline.ts       # 6-stage pipeline: plan → search → extract → summarize → analyze
web/                  # Next.js dashboard (week 2 of the build plan)
```

## Pipeline

1. **Planner** (fast model) — topic → 3–5 search queries with freshness windows
2. **Search** (Tavily Search API, advanced depth, time-bounded)
3. **Dedupe** (code) — top 10 unique URLs
4. **Extract** (Tavily Extract API) — full clean text
5. **Summarizer** (fast model, parallel) — 1 paragraph + key claims per source
6. **Analyst** (reasoning model, once) — score 0–100, verdict, catalysts, risk flags, all grounded in sources

## Scripts

- `npm run research -- "<topic>"` — run a research job from the CLI
- `npm run typecheck` — TypeScript check

## Debugging

Set `DOWORACLE_DEBUG=1` to log per-source extraction stats (char counts)
during a run:

```bash
DOWORACLE_DEBUG=1 npm run research -- "<topic>"
```

## License

MIT — see [LICENSE](LICENSE).
