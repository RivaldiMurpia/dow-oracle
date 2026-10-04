// POST /api/research — runs the DOWOracle pipeline and streams progress
// as Server-Sent Events, then the final SignalReport.
//
// Events:
//   event: progress  data: { stage, message }
//   event: report    data: { ...SignalReport }
//   event: error     data: { message }

import { runResearch } from "../../../../src/agent/pipeline";

export const dynamic = 'force-dynamic';
// A full run takes 20-40s; keep the function alive for the whole pipeline.
export const maxDuration = 60;

export async function POST(req: Request) {
  let topic: unknown = null;
  try {
    topic = (await req.json()).topic;
  } catch {
    /* fall through to the 400 below */
  }
  if (typeof topic !== 'string' || topic.trim().length === 0) {
    return Response.json({ error: 'topic is required' }, { status: 400 });
  }

  const query = topic.trim();
  const encoder = new TextEncoder();

  // Fail fast on server misconfiguration — otherwise a missing/invalid key
  // surfaces later as a misleading "try a different topic" error.
  const requiredEnv = [
    'NEBIUS_API_KEY',
    'NEBIUS_BASE_URL',
    'NEBIUS_MODEL_FAST',
    'NEBIUS_MODEL_REASONING',
    'TAVILY_API_KEY',
  ];
  const missingEnv = requiredEnv.filter((k) => !process.env[k]?.trim());

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      try {
        if (missingEnv.length > 0) {
          throw new Error(
            `Server misconfigured: missing ${missingEnv.join(', ')} — add them in Vercel → Project → Settings → Environment Variables.`,
          );
        }
        const report = await runResearch(query, (e) => send('progress', e));
        send('report', report);
      } catch (err) {
        send('error', {
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
