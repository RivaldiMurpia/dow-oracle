// CLI entry: npm run research -- "your topic here" [--save]
// Loads .env, runs the pipeline, prints the Markdown report.
// --save (-s): also write the report to reports/<slug>-<timestamp>.md

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runResearch, reportToMarkdown, usageSummary } from './agent/pipeline.js';

const rawArgs = process.argv.slice(2);
const save = rawArgs.includes('--save') || rawArgs.includes('-s');
const topic = rawArgs
  .filter((a) => a !== '--save' && a !== '-s')
  .join(' ')
  .trim();

if (!topic) {
  console.error('Usage: npm run research -- "what is heating up in the Monad ecosystem?" [--save]');
  process.exit(1);
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'report'
  );
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

console.log(`\n🔮 DOWOracle researching: "${topic}"\n`);

try {
  const report = await runResearch(topic, (e) => {
    const icon =
      e.stage === 'planning'
        ? '🧭'
        : e.stage === 'searching'
          ? '🔍'
          : e.stage === 'extracting'
            ? '📄'
            : e.stage === 'summarizing'
              ? '⚡'
              : e.stage === 'analyzing'
                ? '🧠'
                : '✅';
    console.log(`${icon} ${e.message}`);
  });
  const md = reportToMarkdown(report);
  console.log('\n' + md + '\n');
  console.log(usageSummary(true) + '\n');
  if (save) {
    mkdirSync('reports', { recursive: true });
    const path = `reports/${slugify(topic)}-${timestamp()}.md`;
    writeFileSync(path, md + '\n', 'utf-8');
    console.log(`💾 Saved to ${path}`);
  }
} catch (err) {
  console.error('\n❌ Research failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
