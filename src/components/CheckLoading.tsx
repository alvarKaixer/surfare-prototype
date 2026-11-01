import { ShieldCheck, Sparkles } from 'lucide-react';

export default function CheckLoading({ stage }: { stage: string }) {
  return (
    <div className="check-loading" role="status" aria-live="polite">
      <div className="scan-scene" aria-hidden="true">
        <div className="scan-halo" />
        <div className="scan-ring" />
        <div className="scan-orb">
          <ShieldCheck size={43} strokeWidth={1.5} />
        </div>
        <Sparkles className="scan-spark spark-one" size={19} />
        <Sparkles className="scan-spark spark-two" size={13} />
      </div>
      <h3>A closer look…</h3>
      <p key={stage} className="stage-caption">
        {stage || 'Getting things ready'}
      </p>
      <div className="loading-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <small>Your result appears when the checks finish.</small>
    </div>
  );
}
