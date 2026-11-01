import test from 'node:test';
import assert from 'node:assert/strict';
import { classificationMetrics, summarizeScenarios } from '../lib/validation-metrics.js';

test('classification accuracy includes abstentions and retains minority-class misses', () => {
  const rows = [
    { label: 'spam', prediction: 'spam' },
    { label: 'spam', prediction: 'abstain' },
    { label: 'ham', prediction: 'ham' },
    { label: 'ham', prediction: 'abstain' },
    { label: 'ham', prediction: 'spam' },
  ];
  const result = classificationMetrics(rows, 'prediction');
  assert.equal(result.accuracy, 2 / 5);
  assert.equal(result.recall, 1 / 2);
  assert.equal(result.precision, 1 / 2);
  assert.equal(result.abstain, 2);
  assert.equal(result.wrong, 1);
  assert.equal(result.correct + result.wrong + result.abstain, result.count);
  assert.equal(result.balancedAccuracy, (1 / 2 + 1 / 3) / 2);
});
test('missing classes and empty sets do not turn into perfect scores', () => {
  assert.equal(classificationMetrics([], 'prediction').accuracy, null);
  assert.equal(
    classificationMetrics([{ label: 'ham', prediction: 'ham' }], 'prediction').balancedAccuracy,
    null,
  );
  assert.throws(() =>
    classificationMetrics([{ label: 'unknown', prediction: 'ham' }], 'prediction'),
  );
});
test('AI scenario scoring counts provider failures and conflicting final results as misses', () => {
  const result = summarizeScenarios([
    {
      language: 'English',
      status: 'completed',
      expected: 'High risk',
      aiLevel: 'High risk',
      combinedLevel: 'High risk',
    },
    {
      language: 'English',
      status: 'unavailable',
      expected: 'High risk',
      combinedLevel: 'High risk',
    },
    {
      language: 'Filipino',
      status: 'completed',
      expected: 'Low risk',
      aiLevel: 'Low risk',
      combinedLevel: 'High risk',
    },
    {
      language: 'Filipino',
      status: 'completed',
      expected: 'Low risk',
      aiLevel: 'Low risk',
      combinedLevel: 'Low risk',
    },
  ]);
  assert.equal(result.matchRate, 0.5);
  assert.equal(result.unavailable, 1);
  assert.equal(result.failed, 2);
  assert.equal(result.byLanguage.English.matchRate, 0.5);
  assert.equal(result.byLanguage.Filipino.matchRate, 0.5);
  assert.equal(summarizeScenarios([]).matchRate, null);
});
