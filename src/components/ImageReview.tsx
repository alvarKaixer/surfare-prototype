import { Sparkles, Info, Check } from 'lucide-react';
import { imageOriginVerdict } from '../../lib/image-origin.js';

export default function ImageReview({ metadata, visual, elapsed, onReset }: any) {
  const verdict = imageOriginVerdict(metadata, visual),
    flagged = verdict.label.includes('AI-generated');
  return (
    <div className={'image-review ' + (flagged ? 'flagged' : '')}>
      <div className="image-review-kicker">
        <Sparkles size={15} />
        AI IMAGE CHECK{elapsed !== null && <span>{(elapsed / 1000).toFixed(1)}s</span>}
      </div>
      <h3>{verdict.label}</h3>
      <div className="image-confidence">
        <span>
          {verdict.confidence === 'High' ? <Check size={12} /> : <Info size={12} />}{' '}
          {verdict.confidence === 'Not measured'
            ? 'Confidence unavailable'
            : verdict.confidence + ' confidence'}
        </span>
        <small>{verdict.source}</small>
      </div>
      <p>{verdict.summary}</p>
      <details className="result-disclosure">
        <summary>Why this result</summary>
        {verdict.observations.length > 0 && (
          <ul>
            {verdict.observations.map((observation: string) => (
              <li key={observation}>{observation}</li>
            ))}
          </ul>
        )}
        <p>{verdict.limitation}</p>
        {metadata?.credentials && (
          <p>Content Credentials marker found; its signature has not been verified.</p>
        )}
        {visual?.model && <small>Visual model: {visual.model}</small>}
      </details>
      <button className="clear" onClick={onReset}>
        New check
      </button>
    </div>
  );
}
