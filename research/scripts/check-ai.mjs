// Optional live smoke test against the running local app. Uses synthetic text only.
// Real API requests consume the selected provider's free quota.
import { assessContent } from '../../lib/content-assessment.js';
import { applySemanticAssessment } from '../../lib/semantic-assessment.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { summarizeScenarios } from '../../lib/validation-metrics.js';
import { detectorFingerprint } from './validation-source.mjs';
const endpoint = 'http://127.0.0.1:8787/api/assess';
const config = await (await fetch(endpoint)).json();
console.log(
  JSON.stringify({
    configured: config.configured,
    provider: config.provider,
    model: config.model,
    freeOnly: config.freeOnly,
  }),
);
if (!config.configured)
  throw Error('Configure the selected server-side AI provider before running this check.');
const suite = await readFile('tests/fixtures/semantic-smoke.json', 'utf8'),
  cases = JSON.parse(suite),
  rows = [];
const sourceSha256 = await detectorFingerprint();
let failed = 0;
for (const sample of cases) {
  const start = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: sample.text,
        kind: 'message',
        consent: true,
        provider: config.providerId,
      }),
      signal: AbortSignal.timeout(45000),
    });
    const result = await response.json();
    const combined = applySemanticAssessment(assessContent({ text: sample.text }), result);
    const passed =
      result.status === 'completed' &&
      result.analysis?.level === sample.expected &&
      combined.level === sample.expected;
    if (!passed) failed++;
    const row = {
      ...sample,
      http: response.status,
      status: result.status,
      model: result.model,
      aiLevel: result.analysis?.level,
      combinedLevel: combined.level,
      elapsedMs: Date.now() - start,
      passed,
      ...(result.message ? { message: result.message } : {}),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  } catch (error) {
    failed++;
    const row = {
      ...sample,
      status: 'unavailable',
      passed: false,
      error: error.name,
      elapsedMs: Date.now() - start,
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
const summary = summarizeScenarios(rows);
if (process.argv.includes('--report')) {
  const report = {
    generatedAt: new Date().toISOString(),
    sourceSha256,
    suiteSha256: createHash('sha256').update(suite).digest('hex'),
    provider: config.provider,
    requestedModel: config.model,
    scope:
      'Live API checks on authored regression scenarios. Not an independent or representative accuracy study. Failures and unavailable responses count as misses. Image recognition and link reputation are not measured.',
    ...summary,
    rows,
  };
  await mkdir('.reports/validation', { recursive: true });
  await writeFile('.reports/validation/ai-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ saved: '.reports/validation/ai-smoke.json', ...summary }));
}
console.log(
  'Synthetic smoke checks only; these do not establish language-wide accuracy or provider uptime.',
);
if (failed) process.exitCode = 1;
