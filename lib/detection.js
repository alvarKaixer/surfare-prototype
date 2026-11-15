  // Several weak hints do not establish a high-risk request.
  const strong =
    indicators.some((i) => i.weight >= 5) ||
    (score >= 5 &&
      indicators.filter((i) => i.id !== 'sms-pattern').length >= 2 &&
      indicators.some((i) => i.weight >= 3 && i.id !== 'sms-pattern'));
