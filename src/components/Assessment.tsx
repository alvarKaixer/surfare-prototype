import { useState } from 'react';
import { AlertTriangle, ShieldCheck, Info, Copy, Check, ArrowUpRight } from 'lucide-react';
import { evidenceSegments } from '../../lib/text-evidence.js';
import { guidance } from '../../lib/guidance.js';

export default function Assessment({
  result,
  semantic,
  verification,
  elapsed,
  sourceLabel,
  online,
  consent,
  busy,
  onReset,
  onError,
}: any) {
  const [selected, setSelected] = useState<string | null>(null),
    [copied, setCopied] = useState(false),
    [evidenceOpen, setEvidenceOpen] = useState(false);
  const indicators = result.indicators || [],
    active = indicators.find((i: any) => i.id === selected) || indicators[0];
  const level = result.level,
    position =
      level === 'Low risk'
        ? 16.7
        : level === 'Suspicious'
          ? 50
          : level === 'High risk'
            ? 83.3
            : null;
  const severity =
    level === 'High risk'
      ? 'high'
      : level === 'Suspicious'
        ? 'suspicious'
        : level === 'Low risk'
          ? 'low'
          : 'unknown';
  const segments = evidenceSegments(result.sourceText || '', indicators),
    steps = guidance(result);
  const aiCompleted = semantic?.status === 'completed',
    aiUnavailable = semantic?.status === 'unavailable';
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        [
          'Surfare: ' + level,
          result.summary,
          ...indicators.map((i: any) => i.title + ': ' + i.message),
          'Recommendation: ' + result.recommendation,
          ...steps,
          'Contextual AI: ' + (semantic?.status || 'not checked'),
          'Google: ' + (verification?.status || 'not checked'),
          'This screening does not guarantee safety.',
        ].join('\n'),
      );
      setCopied(true);
    } catch {
      onError('Copy unavailable. You can select and copy the result text.');
    }
  }
  return (
    <div className={'assessment assessment-v2 ' + severity}>
      <div className="verdict-heading">
        <div className="verdict-icon">
          {severity === 'high' || severity === 'suspicious' ? (
            <AlertTriangle size={28} />
          ) : severity === 'low' ? (
            <ShieldCheck size={28} />
          ) : (
            <Info size={28} />
          )}
        </div>
        <div>
          <span className="result-kicker">YOUR ASSESSMENT</span>
          <h3>{level}</h3>
        </div>
      </div>
      <div
        className={'risk-scale ' + (position === null ? 'unconfirmed' : '')}
        role="img"
        aria-label={'Risk category: ' + level + '. Category, not a probability.'}
      >
        <div className="risk-track">
          <span />
          <span />
          <span />
          {position !== null && <i style={{ left: position + '%' }} />}
        </div>
        <div className="risk-labels">
          {['Low risk', 'Suspicious', 'High risk'].map((label) => (
            <span key={label} className={level === label ? 'current' : ''}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="result-checks">
        <span
          className={'check-chip ' + (aiCompleted ? 'done' : aiUnavailable ? 'unavailable' : '')}
        >
          {aiCompleted ? <Check size={12} /> : <Info size={12} />}{' '}
          {aiCompleted
            ? 'AI assessed'
            : aiUnavailable
              ? 'AI unavailable · local checks only'
              : 'Local checks only'}
        </span>
        {elapsed !== null && <span className="check-time">{(elapsed / 1000).toFixed(1)}s</span>}
      </div>
      {result.semanticConflict && (
        <p className="result-notice">
          AI and local checks disagree. The stronger warning is retained.
        </p>
      )}
      <p className="verdict-summary">{result.summary || result.recommendation}</p>
      {!!result.sourceText && (
        <section className="evidence-reader">
          <div className="evidence-header">
            <span>{sourceLabel}</span>
            {indicators.some((i: any) => i.evidence?.length) && <span>Tap a highlight</span>}
          </div>
          <div
            className="evidence-text"
            aria-label="Analyzed content with highlighted warning signs"
          >
            {segments.map((segment: any) =>
              segment.ids.length ? (
                <button
                  key={segment.start}
                  type="button"
                  className={
                    'evidence-flag ' + (segment.ids.includes(active?.id) ? 'selected' : '')
                  }
                  aria-pressed={segment.ids.includes(active?.id)}
                  aria-controls="flag-explanation"
                  title={segment.ids
                    .map((id: string) => indicators.find((i: any) => i.id === id)?.title)
                    .join(' · ')}
                  onClick={() => {
                    setSelected(
                      segment.ids.find((id: string) => id !== active?.id) || segment.ids[0],
                    );
                    setEvidenceOpen(true);
                  }}
                >
                  {segment.text}
                </button>
              ) : (
                <span key={segment.start}>{segment.text}</span>
              ),
            )}
          </div>
          {sourceLabel.includes('OCR') && (
            <p className="ocr-review-note">Review the extracted text against your image.</p>
          )}
        </section>
      )}
      {active && (
        <details
          className="result-disclosure evidence-details"
          open={evidenceOpen}
          onToggle={(e) => setEvidenceOpen(e.currentTarget.open)}
        >
          <summary>
            Why this was flagged <span>{indicators.length}</span>
          </summary>
          <div className="flag-explanation" id="flag-explanation">
            <h4>{active.title || 'Warning sign'}</h4>
            <p>{active.message}</p>
          </div>
          {indicators.length > 1 && (
            <div className="flag-list" aria-label="Detected warning signs">
              {indicators.map((i: any, index: number) => (
                <button
                  key={i.id}
                  className={i.id === active?.id ? 'selected' : ''}
                  onClick={() => setSelected(i.id)}
                  aria-pressed={i.id === active?.id}
                  aria-controls="flag-explanation"
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{i.title || i.message}</strong>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          )}
        </details>
      )}
      <section className="recommendation-card">
        <span className="result-kicker">NEXT STEP</span>
        <p>{result.recommendation}</p>
        <details className="next-step-details">
          <summary>More ways to stay safe</summary>
          <ol>
            {steps.map((step: string) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      </section>
      {!!result.urls.length && (
        <details className="result-disclosure">
          <summary>
            Link checks <span>{result.urls.length}</span>
          </summary>
          <div className="found-links">
            {result.urls.map((url: any) => (
              <div className="url-result" key={url.url}>
                <strong>{url.domain}</strong>
                <code>{url.url}</code>
              </div>
            ))}
          </div>
          <div className="verification">
            <h4>Google Safe Browsing</h4>
            {verification?.status === 'completed' ? (
              verification.results.map((v: any) => (
                <p key={v.url}>
                  <strong>
                    {v.threats.length
                      ? 'Google threat match: ' + v.threats.join(', ')
                      : 'No known threat match · safety unconfirmed'}
                  </strong>
                  <small>{v.url}</small>
                </p>
              ))
            ) : (
              <p>
                {verification?.message ||
                  (!online
                    ? 'Unavailable offline.'
                    : !consent
                      ? 'Not selected for this check.'
                      : 'The lookup was not completed.')}
              </p>
            )}
            <p className="google-attribution">
              No match does not prove safety.{' '}
              <a
                href="https://developers.google.com/safe-browsing/v4/advisory"
                target="_blank"
                rel="noreferrer"
              >
                Advisory provided by Google
              </a>
              .
            </p>
          </div>
        </details>
      )}
      <details className="result-disclosure">
        <summary>Check details & limitations</summary>
        <div className="check-detail-copy">
          <p>
            {aiCompleted
              ? (semantic.provider || 'Contextual AI') +
                ' assessed the wording. It can still misunderstand context.'
              : semantic?.message ||
                'Message meaning was not assessed by AI. Local patterns can miss unfamiliar wording.'}
          </p>
          {semantic?.model && <p>Model: {semantic.model}</p>}
          <ul>
            {(result.limitations || []).map((item: string) => (
              <li key={item}>{item}</li>
            ))}
            <li>The risk bar shows a category, not a probability.</li>
          </ul>
        </div>
      </details>
      <div className="result-actions">
        <button className="clear" disabled={busy} onClick={onReset}>
          New check
        </button>
        <button className="clear" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy result'}
        </button>
      </div>
    </div>
  );
}
