import { useEffect, useState } from 'react';
import {
  feedbackTags,
  feedbackLevels,
  tagsForAssessment,
  redactFeedbackExcerpt,
} from '../../lib/feedback.js';
import {
  queueFeedback,
  flushFeedback,
  listFeedback,
  withdrawFeedback,
  clearLocalFeedback,
} from '../services/feedback-store';
import '../styles/feedback.css';

export default function Feedback({ result, kind }: { result: any; kind: string }) {
  const [tags, setTags] = useState<string[]>(() => tagsForAssessment(result) as string[]);
  const [correction, setCorrection] = useState('');
  const [expected, setExpected] = useState('');
  const [consent, setConsent] = useState(false);
  const [contentConsent, setContentConsent] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/feedback', { cache: 'no-store', signal: AbortSignal.timeout(3000) })
      .then((r) => r.json())
      .then((r) => {
        if (active) setConfigured(r.configured === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const preview = redactFeedbackExcerpt(excerpt);
  useEffect(() => {
    if (!submissionId) return;
    let active = true;
    const refresh = () => {
      void listFeedback()
        .then((items) => {
          if (!active) return;
          const item = items.find((entry) => entry.id === submissionId);
          setMessage(
            item?.state === 'sent'
              ? 'Thank you. Your feedback was received for review.'
              : item?.state === 'pending'
                ? 'Saved on this device. We will send it when connected. You can cancel it in Manage feedback.'
                : item?.state === 'deleting'
                  ? 'Your feedback is waiting to be deleted.'
                  : 'This feedback is no longer saved on this device.',
          );
        })
        .catch(() => {
          if (active) setMessage('Open Manage feedback to check its delivery status.');
        });
    };
    refresh();
    window.addEventListener('surfare-feedback-change', refresh);
    return () => {
      active = false;
      window.removeEventListener('surfare-feedback-change', refresh);
    };
  }, [submissionId]);
  async function submit() {
    setBusy(true);
    try {
      const id = await queueFeedback({
        kind,
        level: result.level,
        correction,
        expectedLevel: expected || null,
        tags,
        consent,
        contentConsent,
        excerpt: contentConsent ? preview : '',
      });
      setSubmitted(true);
      setSubmissionId(id);
      setExcerpt('');
      setMessage('Approved feedback saved in your queue.');
      await flushFeedback();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit feedback.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="feedback-panel">
      <summary>
        {submitted ? 'Your feedback' : 'Does this result look right?'} <span>Optional</span>
      </summary>
      <p>
        {submitted
          ? 'Our team uses feedback to review possible mistakes.'
          : 'A quick response helps us find mistakes. Your message or image is not attached.'}
      </p>
      {configured === false && (
        <p className="feedback-notice">
          Feedback cannot be sent right now. You can choose to save it on this device for later.
        </p>
      )}
      {!submitted && (
        <fieldset disabled={busy}>
          <legend className="feedback-sr-only">How was this assessment?</legend>
          <div className="feedback-responses" role="group" aria-label="How was this assessment?">
            {Object.entries({
              correct: 'Looks right',
              too_high: 'Too cautious',
              too_low: 'Missed a risk',
              unsure: 'Not sure',
            }).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={correction === value}
                onClick={() => {
                  setCorrection(value);
                  setExpected('');
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {correction && (
            <>
              <details className="feedback-extra">
                <summary>
                  Add details <span>Optional</span>
                </summary>
                {['too_high', 'too_low'].includes(correction) && (
                  <label>
                    What result did you expect? (optional)
                    <select value={expected} onChange={(e) => setExpected(e.target.value)}>
                      <option value="">Not sure</option>
                      {feedbackLevels.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </label>
                )}
                <p>Select only the warning tags you agree to share:</p>
                <div className="feedback-tags">
                  {Object.entries(feedbackTags).map(([id, label]) => (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={tags.includes(id)}
                        onChange={(e) =>
                          setTags(
                            e.target.checked ? [...tags, id] : tags.filter((tag) => tag !== id),
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label className="feedback-choice">
                  <input
                    type="checkbox"
                    checked={contentConsent}
                    onChange={(e) => {
                      setContentConsent(e.target.checked);
                      setExcerpt('');
                    }}
                  />
                  I also choose to share a short excerpt for review.
                </label>
                {contentConsent && (
                  <div className="feedback-excerpt">
                    <p>
                      Paste only the relevant words, up to 600 characters. Remove names, addresses,
                      account details and other identifying context. The filter cannot find every
                      identifier. No image or full scan is attached automatically.
                    </p>
                    <label>
                      Optional excerpt
                      <textarea
                        value={excerpt}
                        maxLength={600}
                        rows={4}
                        onChange={(e) => setExcerpt(e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </details>
              <div className="feedback-preview">
                <strong>Sharing summary</strong>
                <p>
                  Input: {kind} · Result: {result.level}
                  <br />
                  Feedback:{' '}
                  {(
                    {
                      correct: 'Seems correct',
                      too_high: 'Risk too high',
                      too_low: 'Risk too low',
                      unsure: 'Unsure',
                    } as Record<string, string>
                  )[correction] || 'Not selected'}
                  {expected ? ' · Expected: ' + expected : ''}
                </p>
                <p>
                  Tags:{' '}
                  {tags.map((tag) => feedbackTags[tag as keyof typeof feedbackTags]).join(', ') ||
                    'None'}
                </p>
                {contentConsent && preview && <p>Excerpt: {preview}</p>}
              </div>
              <label className="feedback-choice">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I agree to share this feedback for review and save it on this device if it cannot
                send.
              </label>
              <p>
                Sends when Surfare is open and online. Unsent feedback expires after 7 days;
                received feedback after 30 days. You can withdraw it in Manage feedback.
              </p>
              <button
                type="button"
                className="clear"
                disabled={!consent || !correction || busy}
                onClick={submit}
              >
                {busy ? 'Saving…' : 'Send feedback'}
              </button>
              <details className="feedback-extra">
                <summary>Privacy details</summary>
                <p>
                  A random submission ID, deletion token, submission time and consent version are
                  also sent. Original scans, model quotes and sender details are not attached
                  automatically.
                </p>
                <p>
                  Pending feedback is encrypted on this device. Encryption and filtering do not make
                  an excerpt anonymous. Server cleanup runs hourly. Feedback is reviewed by the
                  team; it does not automatically retrain the app or change this result.
                </p>
              </details>
            </>
          )}
        </fieldset>
      )}
      <p role="status">{message}</p>
      {submitted && (
        <button
          type="button"
          className="clear"
          onClick={() => {
            const manager = document.getElementById('feedback-manager');
            let parent: HTMLElement | null = manager;
            while (parent) {
              if (parent instanceof HTMLDetailsElement) parent.open = true;
              parent = parent.parentElement;
            }
            manager?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'auto'
                : 'smooth',
              block: 'center',
            });
            manager?.querySelector('summary')?.focus();
          }}
        >
          View feedback status
        </button>
      )}
    </details>
  );
}

export function FeedbackManager() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listFeedback>>>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [clearConsent, setClearConsent] = useState(false);
  useEffect(() => {
    let active = true;
    const reload = () => {
      void listFeedback()
        .then((rows) => {
          if (active) setItems(rows);
        })
        .catch(() => {
          if (active) setMessage('Feedback storage is unavailable in this browser.');
        });
    };
    const sync = () => {
      void flushFeedback()
        .then((status) => {
          if (active && status) setMessage(status);
        })
        .catch(() => {});
    };
    reload();
    sync();
    const timer = window.setInterval(sync, 60000);
    window.addEventListener('online', sync);
    window.addEventListener('surfare-feedback-change', reload);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('online', sync);
      window.removeEventListener('surfare-feedback-change', reload);
    };
  }, []);
  async function withdraw(id: string) {
    setBusy(true);
    try {
      setMessage(
        (await withdrawFeedback(id)) || 'Withdrawal queued. Content removed from this device.',
      );
    } catch {
      setMessage('Withdrawal could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details id="feedback-manager" className="feedback-panel feedback-manager">
      <summary>Manage feedback {items.length ? `(${items.length})` : ''}</summary>
      <p>See what was sent, or withdraw feedback you no longer want to share.</p>
      {!items.length && <p>No feedback or receipts saved on this device.</p>}
      {items.map((item) => (
        <div className="feedback-entry" key={item.id}>
          <span>
            {item.state === 'pending'
              ? 'Waiting to send'
              : item.state === 'sent'
                ? 'Received for review'
                : 'Deletion pending'}
            <br />
            <small>
              {new Date(item.createdAt).toLocaleDateString()} · {item.id.slice(0, 8)}
              {item.contentIncluded ? ' · includes excerpt' : ''}
            </small>
          </span>
          <button
            type="button"
            className="clear"
            disabled={busy || item.state === 'deleting'}
            onClick={() => withdraw(item.id)}
          >
            {item.state === 'pending' ? 'Cancel feedback' : 'Delete feedback'}
          </button>
        </div>
      ))}
      <p role="status">{message}</p>
      <details className="feedback-extra">
        <summary>Storage & deletion details</summary>
        <p>
          Unsent feedback expires after 7 days. Submitted content expires after 30 days, with hourly
          cleanup. A receipt on this browser lets you request deletion without an account. Offline
          deletion requests wait for a connection.
        </p>
        <p>
          Deletion removes submitted content. An opaque ID and token hash remain for 37 days to stop
          retries restoring it. Hosting logs and backups follow the providers' retention policies.
        </p>
      </details>
      <details>
        <summary>Clear this browser’s feedback storage</summary>
        <p>
          This cancels pending sends and removes local deletion receipts. It does not delete already
          submitted feedback. Use “Withdraw & delete” above first to request server deletion.
        </p>
        <label className="feedback-choice">
          <input
            type="checkbox"
            checked={clearConsent}
            onChange={(e) => setClearConsent(e.target.checked)}
          />
          I understand that local deletion receipts will be lost.
        </label>
        <button
          type="button"
          className="clear"
          disabled={!clearConsent || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await clearLocalFeedback();
              setClearConsent(false);
              setMessage('Local feedback storage cleared.');
            } catch {
              setMessage('Could not clear local storage.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Clear local feedback
        </button>
      </details>
    </details>
  );
}
