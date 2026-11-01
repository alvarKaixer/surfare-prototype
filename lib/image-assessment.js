import { validateSemanticResult } from './semantic-assessment.js';

export const imageOriginLabels = ['AI-like visual cues', 'No clear AI cues', 'Uncertain'];
export function validateImageAssessment(value) {
  if (!value || typeof value.extractedText !== 'string' || value.extractedText.length > 12000)
    throw Error('Invalid image text.');
  validateSemanticResult(value.analysis, value.extractedText);
  const origin = value.origin;
  if (
    !origin ||
    !imageOriginLabels.includes(origin.label) ||
    typeof origin.summary !== 'string' ||
    !origin.summary.trim() ||
    origin.summary.length > 800 ||
    !Array.isArray(origin.observations) ||
    origin.observations.length > 4 ||
    origin.observations.some((s) => typeof s !== 'string' || !s.trim() || s.length > 400)
  )
    throw Error('Invalid visual-origin review.');
  if (origin.label === 'AI-like visual cues' && !origin.observations.length)
    throw Error('Missing visual observations.');
  if (!value.extractedText.trim() && value.analysis.level !== 'Insufficient evidence')
    throw Error('No readable text cannot receive a text safety verdict.');
  return value;
}
