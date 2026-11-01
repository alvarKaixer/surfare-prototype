// Keep local findings distinct from reputation results. No match is not proof of safety.
export function combineAssessment(local, verification = null) {
  const base = { ...local, localLevel: local.level };
  if (verification?.status === 'completed' && verification.results?.some((r) => r.threats?.length))
    return {
      ...base,
      level: 'High risk',
      summary: local.indicators.some((i) => i.category === 'personal safety')
        ? local.summary + ' Google also reports an unsafe URL.'
        : 'Google Safe Browsing reports a potentially unsafe URL.',
      recommendation: local.indicators.some((i) => i.category === 'personal safety')
        ? local.recommendation
        : 'Avoid opening this address or submitting information. Use the official app or a known contact to verify the request.',
    };
  if (local.urls.length && local.level === 'Low risk')
    return {
      ...base,
      level: 'Insufficient evidence',
      summary:
        'No strong local URL warning signs were found, but the destination’s safety is unconfirmed.',
      recommendation:
        'Verify the destination through an official source before sharing information. A no-match reputation result does not guarantee safety.',
    };
  return base;
}
