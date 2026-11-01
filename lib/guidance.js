export function guidance(result) {
  const ids = result.indicators.flatMap((i) => [i.id, i.kind].filter(Boolean)),
    has = (...names) => names.some((n) => ids.includes(n)),
    steps = [];
  if (has('violence', 'extortion', 'blackmail', 'intimidation')) {
    steps.push(
      'If you believe someone may hurt you now, move to a safer place if possible and contact local emergency services or a trusted person nearby.',
    );
    steps.push(
      'Save the original message, sender details, and screenshots. Avoid confronting or meeting the sender alone. Report threats through the platform and appropriate local authorities.',
    );
    if (has('extortion', 'blackmail'))
      steps.push(
        'Avoid sending more money or private material in response to threats. Ask someone you trust to help you document and report the coercion.',
      );
  }
  if (has('secret'))
    steps.push(
      'Keep OTPs, passwords and PINs private. If you already shared a password, change it through the official app and end unfamiliar sessions.',
    );
  if (has('advance-fee', 'reward-action', 'reward-information', 'reward-pressure'))
    steps.push(
      'Do not pay a fee or enter personal details to unlock an unexpected prize. Verify the promotion through the organization’s official app or website.',
    );
  if (has('investment', 'job-fee'))
    steps.push(
      'Pause any deposit or transfer. Verify the company and offer through an independent official contact before paying.',
    );
  if (has('remote'))
    steps.push(
      'Do not install remote-control software at a stranger’s request. If access was already granted, disconnect it and seek help from a trusted technician.',
    );
  if (has('personal'))
    steps.push(
      'Avoid sending identification or financial details through an unverified message. Confirm the request through a contact you already know.',
    );
  if (has('delivery'))
    steps.push(
      'Check the tracking number in the courier’s official app. Confirm any delivery fee through its published support channel.',
    );
  if (has('new-number'))
    steps.push('Call the person using their previously known number before transferring money.');
  if (has('download'))
    steps.push(
      'Install apps from a trusted app store or the publisher’s verified website. Do not run an unexpected attachment or installer.',
    );
  if (result.urls.length)
    steps.push(
      'Open the organization’s official app or type its known website yourself. Check the actual domain shown here; a familiar name elsewhere in a link is not proof of identity.',
    );
  if (
    (result.level === 'High risk' || result.level === 'Suspicious') &&
    (!has('violence', 'intimidation') || has('extortion'))
  )
    steps.push(
      'If you already sent money, contact your bank or payment provider promptly through its official support channel. Save evidence and report the message in the app where you received it.',
    );
  if (!steps.length)
    steps.push(
      'Check who sent this and whether you expected it. Confirm surprising requests through another trusted channel before acting.',
    );
  return steps;
}
