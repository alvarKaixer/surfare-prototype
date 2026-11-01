import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { classifySms } from '../../lib/sms-model.js';
import { assessContent } from '../../lib/content-assessment.js';

const split = process.argv.includes('--test') ? 'test' : 'validation';
const prepared = JSON.parse(await readFile('.preview/datasets/prepared.json', 'utf8'));
const cases = prepared.rows.filter((r) => r.split === split);
const rows = cases.map((c) => {
  const local = assessContent({ text: c.text });
  return {
    ...c,
    model: classifySms(c.text).flagged ? 'spam' : 'ham',
    pipeline: ['Suspicious', 'High risk'].includes(local.level)
      ? 'spam'
      : local.level === 'Low risk'
        ? 'ham'
        : 'abstain',
    level: local.level,
    signals: local.indicators.map((i) => i.id),
  };
});
function metrics(group, key) {
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0,
    abstain = 0;
  for (const r of group) {
    if (r[key] === 'abstain') abstain++;
    if (r.label === 'spam') {
      r[key] === 'spam' ? tp++ : fn++;
    } else if (r[key] === 'ham') tn++;
    else if (r[key] === 'spam') fp++;
  }
  const positives = group.filter((r) => r.label === 'spam').length,
    negatives = group.length - positives;
  return {
    count: group.length,
    tp,
    tn,
    fp,
    fn,
    abstain,
    accuracy: (tp + tn) / group.length,
    precision: tp / (tp + fp) || 0,
    recall: tp / positives || 0,
    falsePositiveRate: fp / negatives || 0,
    balancedAccuracy: (tp / positives + tn / negatives) / 2,
  };
}
const report = {
  split,
  modelSha256: createHash('sha256')
    .update(await readFile('lib/models/sms-model.json'))
    .digest('hex'),
  scope:
    'Public spam/ham corpora; not a validated scam, violence, OCR, URL-reputation or QR benchmark. Philippine corpus is multilingual but has no per-message language labels.',
  provenance: prepared.provenance,
  model: metrics(rows, 'model'),
  displayedAssessment: metrics(rows, 'pipeline'),
  bySource: Object.fromEntries(
    [...new Set(rows.map((r) => r.source))].map((source) => [
      source,
      {
        model: metrics(
          rows.filter((r) => r.source === source),
          'model',
        ),
        displayedAssessment: metrics(
          rows.filter((r) => r.source === source),
          'pipeline',
        ),
      },
    ]),
  ),
};
await mkdir('.reports/model', { recursive: true });
await writeFile(
  '.reports/model/' + split + '-benchmark.json',
  JSON.stringify(report, null, 2) + '\n',
);
// Test mistakes are not exposed for tuning. Validation rows may inform development.
if (split === 'validation')
  await writeFile(
    '.reports/model/validation-errors.json',
    JSON.stringify(
      rows.filter((r) => r.pipeline !== r.label),
      null,
      2,
    ),
  );
console.log(JSON.stringify(report, null, 2));
