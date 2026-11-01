import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { classifySms } from '../../lib/sms-model.js';
import { assessContent } from '../../lib/content-assessment.js';
import { classificationMetrics } from '../../lib/validation-metrics.js';
import { detectorFingerprint } from './validation-source.mjs';

const labels = {
  detection: 'Message & URL detection',
  hosting: 'Hosting & routing',
  ocr: 'Image text recognition',
  provenance: 'Image metadata',
  safety: 'Threat & benign-context rules',
  semantic: 'AI requests & safety handling',
  validation: 'Statistics integrity',
};
const files = (await readdir('tests')).filter((name) => name.endsWith('.test.mjs')).sort(),
  groups = [];
for (const file of files) {
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/' + file], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  const output = run.stdout || '',
    number = (name) =>
      Number(output.match(new RegExp('^# ' + name + ' ([\\d.]+)$', 'm'))?.[1] || 0);
  const group = {
    file: 'tests/' + file,
    name: labels[file.replace('.test.mjs', '')] || file,
    total: number('tests'),
    passed: number('pass'),
    failed: number('fail'),
    skipped: number('skipped'),
    cancelled: number('cancelled'),
    todo: number('todo'),
    durationMs: number('duration_ms'),
    executionFailed: run.status !== 0,
  };
  groups.push(group);
  console.log(group.name + ': ' + group.passed + '/' + group.total + ' passed');
  if (group.executionFailed) console.error(output, run.stderr || '', run.error?.message || '');
}
const total = groups.reduce((n, g) => n + g.total, 0),
  passed = groups.reduce((n, g) => n + g.passed, 0);
const regression = {
  total,
  passed,
  failed: groups.reduce((n, g) => n + g.failed, 0),
  skipped: groups.reduce((n, g) => n + g.skipped, 0),
  cancelled: groups.reduce((n, g) => n + g.cancelled, 0),
  passRate: total ? passed / total : null,
  successful: groups.every((g) => !g.executionFailed) && total > 0,
  groups,
  scope:
    'Automated code regression checks. AI and reputation services are mocked; this pass rate is not detection accuracy.',
};
const archive = JSON.parse(await readFile('docs/detection-benchmark.json', 'utf8'));
const modelSha256 = createHash('sha256')
  .update(await readFile('lib/models/sms-model.json'))
  .digest('hex');
let benchmark = {
  kind: 'archived-model',
  modelSha256,
  model: archive.modelSha256 === modelSha256 ? archive.model : null,
  currentLocal: null,
  bySource: archive.modelSha256 === modelSha256 ? archive.bySource : null,
  provenance: archive.provenance,
};
try {
  const preparedRaw = await readFile('.preview/datasets/prepared.json', 'utf8'),
    prepared = JSON.parse(preparedRaw);
  const testRows = prepared.rows.filter((r) => r.split === 'test');
  const rows = testRows.map((c) => {
    const local = assessContent({ text: c.text });
    return {
      ...c,
      model: classifySms(c.text).flagged ? 'spam' : 'ham',
      local: ['Suspicious', 'High risk'].includes(local.level)
        ? 'spam'
        : local.level === 'Low risk'
          ? 'ham'
          : 'abstain',
    };
  });
  benchmark = {
    kind: 'recomputed',
    modelSha256,
    preparedSha256: createHash('sha256').update(preparedRaw).digest('hex'),
    model: classificationMetrics(rows, 'model'),
    currentLocal: classificationMetrics(rows, 'local'),
    bySource: Object.fromEntries(
      [...new Set(rows.map((r) => r.source))].map((source) => [
        source,
        {
          model: classificationMetrics(
            rows.filter((r) => r.source === source),
            'model',
          ),
          currentLocal: classificationMetrics(
            rows.filter((r) => r.source === source),
            'local',
          ),
        },
      ]),
    ),
    provenance: prepared.provenance,
  };
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
benchmark.scope =
  'Held-out public SMS spam/ham classification, not verified fraud, personal threats, image authenticity, OCR or live AI accuracy. The current local fallback abstains when meaning is not assessed.';
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceSha256: await detectorFingerprint(),
  target: 0.9,
  regression,
  benchmark,
};
await mkdir('.reports/validation', { recursive: true });
await writeFile('.reports/validation/report.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    saved: '.reports/validation/report.json',
    regressions: passed + '/' + total,
    modelAccuracy: benchmark.model?.accuracy,
    localOnlyAccuracy: benchmark.currentLocal?.accuracy,
  }),
);
if (!regression.successful) process.exitCode = 1;
