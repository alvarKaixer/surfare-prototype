// Shared, closed vocabulary: no quoted evidence, URLs, identifiers or model output in tags.
export const feedbackPolicy = 'feedback-v1';
export const feedbackRetentionDays = 30;
export const feedbackQueueDays = 7;
export const feedbackTags = {
  urgency: 'Urgency or pressure',
  secret: 'OTP or password request',
  suspicious_link: 'Suspicious link',
  impersonation: 'Possible impersonation',
  advance_payment: 'Advance payment',
  investment: 'Investment promise',
  job_offer: 'Work or task offer',
  delivery: 'Delivery problem',
  prize: 'Prize or winnings',
  loan: 'Loan offer',
  benefit: 'Benefit claim',
  remote_access: 'Remote access',
  personal_information: 'Personal information request',
  threat: 'Threat or intimidation',
  spam_pattern: 'Spam-like wording',
};
export const feedbackLevels = ['Low risk', 'Suspicious', 'High risk', 'Insufficient evidence'];
export function tagsForAssessment(result) {
  const tags = new Set();
  for (const i of result.indicators || []) {
    const id = i.kind || i.id || '';
    if (/pressure|urgent/.test(id)) tags.add('urgency');
    if (id === 'secret') tags.add('secret');
    if (i.category === 'link') tags.add('suspicious_link');
    if (/brand-|lookalike-|new-number|cancel-lure/.test(id)) tags.add('impersonation');
    if (/advance-fee|job-fee|loan-fee|load-transfer/.test(id)) tags.add('advance_payment');
    if (/investment/.test(id)) tags.add('investment');
    if (/job|task/.test(id)) tags.add('job_offer');
    if (/delivery/.test(id)) tags.add('delivery');
    if (/reward|winnings|prize/.test(id)) tags.add('prize');
    if (/loan/.test(id)) tags.add('loan');
    if (/benefit/.test(id)) tags.add('benefit');
    if (id === 'remote') tags.add('remote_access');
    if (id === 'personal') tags.add('personal_information');
    if (i.category === 'personal safety') tags.add('threat');
    if (id === 'sms-pattern') tags.add('spam_pattern');
  }
  return [...tags];
}
// Best-effort minimization only: names and indirect identifiers still need user review.
export function redactFeedbackExcerpt(text) {
  return text
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\b(?:[a-z\d-]+\.)+[a-z]{2,}(?:\/\S*)?/gi, '[link]')
    .replace(/(?:\+?\d[\d\s().-]{5,}\d)/g, '[number]')
    .replace(/\b(?:otp|pin|password|passcode|verification code)\s*[:=]?\s*\S+/gi, '[secret]')
    .slice(0, 600);
}
export function validateFeedback(body) {
  const keys = [
    'id',
    'token',
    'policy',
    'consent',
    'contentConsent',
    'createdAt',
    'kind',
    'level',
    'correction',
    'expectedLevel',
    'tags',
    'excerpt',
  ];
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !keys.includes(k)) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.id) ||
    !/^[a-f0-9]{64}$/.test(body.token) ||
    body.policy !== feedbackPolicy ||
    body.consent !== true ||
    typeof body.contentConsent !== 'boolean' ||
    !['message', 'link', 'image', 'qr'].includes(body.kind) ||
    !feedbackLevels.includes(body.level) ||
    !['correct', 'too_high', 'too_low', 'unsure'].includes(body.correction) ||
    !(body.expectedLevel === null || feedbackLevels.includes(body.expectedLevel)) ||
    !Array.isArray(body.tags) ||
    body.tags.length > 15 ||
    body.tags.some((t) => !Object.hasOwn(feedbackTags, t)) ||
    typeof body.excerpt !== 'string' ||
    body.excerpt.length > 600 ||
    (body.excerpt.length > 0 && !body.contentConsent) ||
    typeof body.createdAt !== 'number' ||
    !Number.isFinite(body.createdAt) ||
    body.createdAt > Date.now() + 300000 ||
    body.createdAt < Date.now() - feedbackQueueDays * 86400000
  )
    throw Error('Invalid feedback. Review the consent and fields before submitting.');
  // Do not silently change approved content: ask the user to review the redacted preview.
  if (redactFeedbackExcerpt(body.excerpt) !== body.excerpt)
    throw Error('Remove contact details, links, numbers or secrets from the excerpt first.');
  return { ...body, tags: [...new Set(body.tags)] };
}
