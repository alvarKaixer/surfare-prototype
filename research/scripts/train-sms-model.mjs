import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { smsFeatures } from '../../lib/sms-features.js';

const data = JSON.parse(await readFile('.preview/datasets/prepared.json', 'utf8'));
const train = data.rows.filter((r) => r.split === 'train'),
  validation = data.rows.filter((r) => r.split === 'validation');
const counts = new Map(),
  totals = [0, 0],
  documents = [0, 0];
for (const row of train) {
  const y = row.label === 'spam' ? 1 : 0;
  documents[y]++;
  for (const f of smsFeatures(row.text).features) {
    if (!counts.has(f)) counts.set(f, [0, 0]);
    counts.get(f)[y]++;
    totals[y]++;
  }
}
const vocabulary = [...counts].filter(([f, c]) => c[0] + c[1] >= 2);
const alpha = 0.5,
  weights = Object.fromEntries(
    vocabulary.map(([f, c]) => [
      f,
      Number(
        Math.log(
          (c[1] + alpha) /
            (totals[1] + alpha * vocabulary.length) /
            ((c[0] + alpha) / (totals[0] + alpha * vocabulary.length)),
        ).toFixed(6),
      ),
    ]),
  );
const intercept = Math.log(documents[1] / documents[0]);
function predict(text, threshold) {
  const { words, features } = smsFeatures(text);
  const known = words.filter((w) => Object.hasOwn(weights, 'w:' + w)).length;
  const score = intercept + features.reduce((s, f) => s + (weights[f] || 0), 0);
  return words.length >= 3 && known / words.length >= 0.35 && score >= threshold;
}
function metrics(rows, threshold) {
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0;
  for (const r of rows) {
    const p = predict(r.text, threshold);
    if (r.label === 'spam') {
      p ? tp++ : fn++;
    } else {
      p ? fp++ : tn++;
    }
  }
  return {
    count: rows.length,
    tp,
    tn,
    fp,
    fn,
    accuracy: (tp + tn) / rows.length,
    precision: tp / (tp + fp) || 0,
    recall: tp / (tp + fn) || 0,
    f1: (2 * tp) / (2 * tp + fp + fn) || 0,
    balancedAccuracy: (tp / (tp + fn) + tn / (tn + fp)) / 2,
  };
}
// Select on validation ONLY. The test partition is never consulted during fitting.
const candidates = Array.from({ length: 25 }, (_, i) => {
  const threshold = i - 4;
  return { threshold, ...metrics(validation, threshold) };
});
const precise = candidates.filter((c) => c.precision >= 0.95);
const selected = (precise.length ? precise : candidates).sort(
  (a, b) => b.f1 - a.f1 || b.precision - a.precision,
)[0];
const model = {
  version: 1,
  method: 'Multinomial naive Bayes, binary word/unigram + bigram features',
  threshold: selected.threshold,
  intercept,
  weights,
};
await mkdir('lib/models', { recursive: true });
await writeFile('lib/models/sms-model.json', JSON.stringify(model));
await mkdir('docs', { recursive: true });
await mkdir('.reports/model', { recursive: true });
await writeFile(
  '.reports/model/training.json',
  JSON.stringify(
    {
      provenance: data.provenance,
      trainingCount: train.length,
      validation: selected,
      modelVocabulary: vocabulary.length,
      testPolicy:
        'Frozen test split must be evaluated after integration. Spam/ham labels are not violence or verified-fraud labels.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({ training: train.length, validation: selected, vocabulary: vocabulary.length }),
);
