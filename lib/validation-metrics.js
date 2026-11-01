export function classificationMetrics(rows, key) {
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0,
    abstain = 0,
    wrong = 0;
  for (const row of rows) {
    if (!['spam', 'ham'].includes(row.label) || !['spam', 'ham', 'abstain'].includes(row[key]))
      throw Error('Invalid classification row.');
    if (row[key] === 'abstain') abstain++;
    else if (row[key] !== row.label) wrong++;
    if (row.label === 'spam') {
      if (row[key] === 'spam') tp++;
      else fn++;
    } else if (row[key] === 'ham') tn++;
    else if (row[key] === 'spam') fp++;
  }
  const count = rows.length,
    positives = rows.filter((r) => r.label === 'spam').length,
    negatives = count - positives;
  return {
    count,
    tp,
    tn,
    fp,
    fn,
    abstain,
    wrong,
    correct: tp + tn,
    accuracy: count ? (tp + tn) / count : null,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: positives ? tp / positives : null,
    falsePositiveRate: negatives ? fp / negatives : null,
    balancedAccuracy: positives && negatives ? (tp / positives + tn / negatives) / 2 : null,
  };
}

export function summarizeScenarios(rows) {
  const group = (items) => {
    const count = items.length,
      completed = items.filter((r) => r.status === 'completed').length;
    const passed = items.filter(
      (r) => r.status === 'completed' && r.aiLevel === r.expected && r.combinedLevel === r.expected,
    ).length;
    return {
      count,
      completed,
      passed,
      failed: count - passed,
      unavailable: count - completed,
      matchRate: count ? passed / count : null,
    };
  };
  return {
    ...group(rows),
    byLanguage: Object.fromEntries(
      [...new Set(rows.map((r) => r.language))].map((language) => [
        language,
        group(rows.filter((r) => r.language === language)),
      ]),
    ),
  };
}
