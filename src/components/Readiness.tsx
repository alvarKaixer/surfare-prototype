import { useState } from 'react';
export default function Readiness({
  online,
  configured,
  aiConfigured,
  aiProvider,
  offline,
  onPrepare,
}: any) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="readiness">
      <div className="readiness-head">
        <div>
          <span className="status-dot" />
          <strong>{online ? 'Local checks ready' : 'Offline · local checks'}</strong>
          {online && aiConfigured && <span>AI configured</span>}
        </div>
        <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? 'Close' : 'Availability'}
        </button>
      </div>
      {expanded && (
        <div className="readiness-body">
          <div>
            <strong>On this device</strong>
            <p>Pattern checks, OCR and QR. Unfamiliar wording may be missed.</p>
          </div>
          <div>
            <strong>AI context</strong>
            <p>
              {!online
                ? 'Unavailable offline.'
                : aiConfigured
                  ? (aiProvider || 'AI') + ' · available in Check options.'
                  : 'Not configured.'}
            </p>
          </div>
          <div>
            <strong>Link reputation</strong>
            <p>
              {online && configured
                ? 'Google · available in Check options.'
                : 'Unavailable. Local URL checks still work.'}
            </p>
          </div>
          <button onClick={onPrepare} disabled={offline.startsWith('Downloading')}>
            {offline.startsWith('Downloading') ? 'Preparing…' : 'Save offline'}
          </button>
        </div>
      )}
    </section>
  );
}
