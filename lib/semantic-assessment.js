// Shared validation and fusion for contextual model results. No provider credentials here.
export const semanticLevels = ['Low risk', 'Suspicious', 'High risk', 'Insufficient evidence'];
export const semanticKinds = [
  'violence',
  'extortion',
  'blackmail',
  'intimidation',
  'harassment',
  'secret',
  'advance-fee',
  'investment',
  'job-fee',
  'remote',
  'personal',
  'scam',
  'other',
];
const titles = {
  violence: 'Threat of physical harm',
  extortion: 'Coercion or extortion',
  blackmail: 'Threat to expose private material',
  intimidation: 'Personal intimidation',
  harassment: 'Targeted harassment',
  secret: 'Request for a secret',
  'advance-fee': 'Advance-payment warning',
  investment: 'Investment warning',
  'job-fee': 'Payment to get work',
  remote: 'Remote control request',
  personal: 'Sensitive information request',
  scam: 'Possible deception',
  other: 'Contextual warning',
};
const bounded = (s, n) => typeof s === 'string' && s.trim().length > 0 && s.length <= n;

export function validateSemanticResult(value, text) {
  if (
    !value ||
    !semanticLevels.includes(value.level) ||
    !bounded(value.summary, 1000) ||
    !bounded(value.recommendation, 1000) ||
    !Array.isArray(value.findings) ||
    value.findings.length > 8
  )
    throw Error('Invalid contextual assessment.');
  const indicators = value.findings.map((f, index) => {
    if (
      !semanticKinds.includes(f.kind) ||
      !['Suspicious', 'High risk'].includes(f.level) ||
      !bounded(f.quote, 700) ||
      !bounded(f.explanation, 1000)
    )
      throw Error('Invalid contextual finding.');
    const start = text.indexOf(f.quote);
    if (start < 0) throw Error('The contextual evidence was not found in the submitted text.');
    return {
      id: 'semantic-' + index,
      kind: f.kind,
      title: titles[f.kind],
      message: f.explanation,
      weight: f.level === 'High risk' ? 6 : 2,
      category: ['violence', 'extortion', 'blackmail', 'intimidation', 'harassment'].includes(
        f.kind,
      )
        ? 'personal safety'
        : 'scam',
      source: 'contextual AI',
      evidence: [{ start, end: start + f.quote.length, text: f.quote }],
    };
  });
  if (['High risk', 'Suspicious'].includes(value.level) && !indicators.length)
    throw Error('Missing evidence for the contextual verdict.');
  if (value.level === 'Low risk' && indicators.length)
    throw Error('Conflicting contextual verdict.');
  if (indicators.some((i) => i.weight === 6) && value.level !== 'High risk')
    throw Error('High-risk evidence cannot be downgraded.');
  return {
    level: value.level,
    summary: value.summary,
    recommendation: value.recommendation,
    indicators,
  };
}

export function applySemanticAssessment(local, response) {
  if (response?.status !== 'completed')
    return { ...local, semanticStatus: response?.status || 'not_checked' };
  let contextual;
  try {
    contextual = validateSemanticResult(response.analysis, local.sourceText || '');
  } catch {
    return { ...local, semanticStatus: 'unavailable' };
  }
  const rank = (level) =>
    ({ 'Insufficient evidence': 0, 'Low risk': 1, Suspicious: 2, 'High risk': 3 })[level] || 0;
  const keepLocal = rank(local.level) > rank(contextual.level);
  const conflict = keepLocal && contextual.level === 'Low risk';
  const merged = {
    ...local,
    level: keepLocal ? local.level : contextual.level,
    summary: keepLocal ? local.summary : contextual.summary,
    recommendation: keepLocal ? local.recommendation : contextual.recommendation,
    indicators: [...contextual.indicators, ...local.indicators],
    semanticStatus: 'completed',
    semanticConflict: conflict,
    limitations: [
      ...local.limitations,
      'Contextual AI can misunderstand wording, sarcasm or missing context. Its assessment does not verify identity or guarantee safety.',
    ],
  };
  if (conflict)
    merged.limitations.unshift(
      'The contextual model and local warnings disagree. The stronger warning is retained for review.',
    );
  if ((local.uncertainExtraction || local.unsupportedQr) && merged.level === 'Low risk')
    return {
      ...merged,
      level: 'Insufficient evidence',
      summary: local.summary,
      recommendation: local.recommendation,
    };
  return merged;
}
