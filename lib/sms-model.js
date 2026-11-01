import model from './models/sms-model.json' with { type: 'json' };
import { smsFeatures } from './sms-features.js';
import { normalizeEvidence, evidenceMatches } from './text-evidence.js';

export function classifySms(text) {
  const { words, features } = smsFeatures(text),
    known = words.filter((w) => Object.hasOwn(model.weights, 'w:' + w)).length;
  const score = model.intercept + features.reduce((sum, f) => sum + (model.weights[f] || 0), 0);
  const coverage = words.length ? known / words.length : 0;
  const flagged = words.length >= 3 && coverage >= 0.35 && score >= model.threshold;
  const source = normalizeEvidence(text);
  const evidence = flagged
    ? features
        .filter(
          (f) =>
            f.startsWith('w:') &&
            !['w:urltoken', 'w:numbertoken'].includes(f) &&
            (model.weights[f] || 0) > 1.5,
        )
        .sort((a, b) => model.weights[b] - model.weights[a])
        .slice(0, 6)
        .flatMap((f) => evidenceMatches(source, new RegExp('\\b' + f.slice(2) + '\\b', 'i')))
    : [];
  return { flagged, coverage, score, threshold: model.threshold, evidence };
}
