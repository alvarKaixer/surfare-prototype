import { analyze } from './detection.js';
import { combineAssessment } from './assessment.js';

// One assessment path for typed messages, addresses, OCR output and QR payloads.
/** @param {{text?:string,urls?:string[],kind?:string,uncertain?:boolean,verification?:any}} options */
export function assessContent({
  text = '',
  urls = [],
  kind = 'message',
  uncertain = false,
  verification = null,
} = {}) {
  const local = analyze(text, urls);
  local.localPatternLevel = local.level;
  local.uncertainExtraction = uncertain;
  const unsupportedQr =
    kind === 'qr' && /^(?:WIFI:|BEGIN:VCARD|otpauth:|upi:|bitcoin:|geo:)/i.test(text.trim());
  const poorEvidence = uncertain || unsupportedQr;
  local.unsupportedQr = unsupportedQr;
  if (poorEvidence && local.level === 'Low risk') {
    local.level = 'Insufficient evidence';
    local.summary = unsupportedQr
      ? 'This QR payload contains data that the message and URL checks cannot validate.'
      : 'The extraction is uncertain. Review or correct the recognized text before relying on this result.';
  }
  if (uncertain)
    local.limitations.unshift(
      'Text recognition was uncertain. Errors can hide warning signs or create false alarms. Review the highlighted words against the image.',
    );
  if (unsupportedQr)
    local.limitations.unshift(
      'Payment, Wi-Fi, location and contact QR payloads are not authenticated by this checker.',
    );
  if (local.level === 'Low risk') {
    local.level = 'Insufficient evidence';
    local.summary = 'The meaning and intent were not assessed. No strong local pattern matched.';
    local.recommendation = 'Use AI backup or ask someone you trust to review it before acting.';
  }
  local.limitations.unshift(
    'The local SMS model recognizes spam-like wording; it is not a semantic threat classifier. A non-match is not evidence of low risk.',
  );
  return combineAssessment(local, verification);
}
