# DOWOracle web dashboard

Next.js dashboard for the DOWOracle crypto research agent. The pipeline
lives in `../src/` (shared with the CLI); the API route streams its
progress events to the browser via SSE.

## Setup

```bash
npm install
```

Copy the API keys into `web/.env.local` (**never commit this file**):

```bash
NEBIUS_BASE_URL=
NEBIUS_API_KEY=
NEBIUS_MODEL_REASONING=
NEBIUS_MODEL_FAST=
TAVILY_API_KEY=
```

Same values as the root `.env` (see `../.env.example`). The keys stay
server-side — the `/api/research` route runs the pipeline in Node and
only streams progress + the final report to the client.

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
```

## Notes

- A full research run takes 20–40s; the route sets `maxDuration = 60`.
- `node_modules/`, `.env.local`, and build output are gitignored.
- `web/package-lock.json` is intentionally not committed (too large for
  the GitHub connector); install fresh with `npm install`.
