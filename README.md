# DOWOracle

**Crypto research agent that answers "so what" — not just "what happened."**

🔮 **Live demo:** [oracle.dowproject.my.id](https://oracle.dowproject.my.id)

Built for the **Nebius x NVIDIA Global AI Hackathon** — Track: **Best Apps and Agents** · also competing for **Best Use of Tavily** ($3,000).

Give it any topic. DOWOracle plans searches, digs through fresh news/forums/threads via **Tavily Search + Extract**, then synthesizes everything into a **signal report**: a 0–100 score, bull/bear/neutral verdict, key catalysts, severity-ranked risk flags — every claim backed by clickable citations. Reasoning by **NVIDIA Nemotron** models on **Nebius Token Factory**.

## Why DOWOracle — and not just Tavily Deep Research?

Tavily's own [Deep Research](https://tavily.com/research) is excellent at *"what happened"* — long-form, general-purpose. DOWOracle answers *"so what"*:

- **Signal, not summary.** Every run ends in a decision-ready output: score, verdict, catalysts, risk flags. Not a reading assignment.
- **Crypto-native at every stage.** The planner always includes scam/risk angles; junk filters drop price pages and extract-hostile domains; the analyst understands token unlocks, governance, and validator dynamics.
- **Honest by design.** When sources are thin or AI-generated slop, the analyst scores low and says so *instead of inventing*. We adversarially tested this: asked about **QuantumFox, a token that doesn't exist** — the analyst returned **0/100 neutral and refused to hallucinate**. For financial decisions, that refusal is the feature.
- **Built on Tavily, not against it.** DOWOracle composes Tavily Search + Extract with Nemotron reasoning into a specialized pipeline — a demonstration of what Tavily's primitives enable when pointed at a real decision problem.
- **Radically transparent.** MIT-licensed, runs on your own API keys, and every run reports its own cost (~$0.11) and per-stage timing.

## How it works

```
 topic
   │
   ▼
┌─────────┐   ┌──────────┐   ┌─────────┐   ┌───────────┐   ┌──────────┐
│ PLANNER │ → │  SEARCH  │ → │ EXTRACT │ → │ SUMMARIZE │ → │ ANALYST  │
│ Nemotron│   │  Tavily  │   │ Tavily  │   │ Nemotron  │   │ Nemotron │
│ 3.5-L   │   │  Search  │   │ Extract │   │  3.5-L    │   │ 3-Ultra  │
│(fast)   │   │(advanced,│   │ (full   │   │(parallel, │   │(reason-  │
│         │   │ time-    │   │  clean  │   │ per-      │   │ ing,     │
│         │   │ bounded) │   │  text)  │   │ source)   │   │  once)   │
└─────────┘   └──────────┘   └─────────┘   └───────────┘   └──────────┘
   │               │               │              │               │
   ▼               ▼               ▼              ▼               ▼
3–5 queries   top 10 URLs    substance      1 paragraph     0–100 score
+ freshness   (junk/spam     pre-check      + key claims    verdict
 windows      filtered)     (code)         per source      catalysts
                                                               risk flags
                                                            + citations
```

Between search and extract, code-level filters drop price-page junk, extract-hostile domains (video/social), and thin content — so paid LLM calls only touch substantive text. The analyst sees *only* grounded summaries, never raw web text, which is what makes the honesty guarantee structural rather than prompt-based.

**Typical run:** ~21s end-to-end · ~16.6k tokens · ~14 Tavily credits · **~$0.11 total** ($0.012 Nebius + $0.099 Tavily).

## Proven results

| Topic | Score | Verdict | Note |
|---|---|---|---|
| QuantumFox (fictional token) | 0/100 | Neutral | **Refused to hallucinate** — adversarial honesty test passed |
| Solid-state batteries | 85/100 | Bullish | Non-crypto generality proven |
| "Is Pi Network a scam?" | 70/100 | Bearish | Balanced, cited red flags |
| Indonesian crypto adoption | 65/100 | — | Multilingual input (ID → EN queries) works |
| Aptos | 65–70/100 | Bullish | Stable across reruns |

## Tech stack

- **Inference:** NVIDIA Nemotron-3.5-Lightning (planner + summarizer) and Nemotron-3-Ultra-550b-a55b (analyst) via **Nebius Token Factory** (OpenAI-compatible)
- **Grounding:** **Tavily** Search (advanced depth) + Extract, with real credit usage tracking
- **Dashboard:** Next.js 16 + React 19, streaming SSE progress → glassmorphism "dawn" UI
- **CLI:** `npm run research -- "<topic>"` — same pipeline, Markdown report output

## Quick start

```bash
npm install
cp .env.example .env
# fill in NEBIUS_BASE_URL, NEBIUS_API_KEY, NEBIUS_MODEL_FAST,
# NEBIUS_MODEL_REASONING, TAVILY_API_KEY (see .env.example)
npm run research -- "what is heating up in the Monad ecosystem?"
```

Dashboard (production runs at [oracle.dowproject.my.id](https://oracle.dowproject.my.id)):

```bash
cd web
npm install
npm run dev
# → http://localhost:3000
# (uses the same NEBIUS_*/TAVILY_* env vars, server-side only)
```

## Project structure

```
src/
  cli.ts              # CLI entry — runs a research job, prints Markdown report
  tavily.ts           # Tavily Search + Extract wrappers (real credit tracking)
  nebius.ts           # Nebius Token Factory client (OpenAI-compatible) + JSON recovery
  agent/
    types.ts          # shared pipeline types
    prompts.ts        # planner / summarizer / analyst prompts
    pipeline.ts       # 6-stage pipeline: plan → search → extract → summarize → analyze
web/                  # Next.js dashboard — SSE streaming, live progress, report cards
  app/api/research/   # POST /api/research — runs the pipeline, streams progress events
```

## Debugging

Set `DOWORACLE_DEBUG=1` to log per-source extraction stats (char counts)
during a run:

```bash
DOWORACLE_DEBUG=1 npm run research -- "<topic>"
```

## License

MIT — see [LICENSE](LICENSE). A [DOW Project](https://dowproject.my.id) build.
