// CLI entry: npm run research -- "your topic here"
// Loads .env, runs the pipeline, prints the Markdown report.

import 'dotenv/config';
import { runResearch, reportToMarkdown } from './agent/pipeline.js';

const topic = process.argv.slice(2).join(' ').trim();

if (!topic) {
  console.error('Usage: npm run research -- "what is heating up in the Monad ecosystem?"');
  process.exit(1);
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
  console.log('\n' + reportToMarkdown(report) + '\n');
} catch (err) {
  console.error('\n❌ Research failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
