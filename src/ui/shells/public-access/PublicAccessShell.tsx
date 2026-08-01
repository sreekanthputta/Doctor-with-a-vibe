import { useState } from 'react';
import { FunctionTraceGroup } from '../../components/FunctionTraceGroup';
import { ShellFrame } from '../../components/ShellFrame';
import { SurfaceStatePanel } from '../../components/SurfaceStatePanel';
import type { ProviderMode, PublicSurfaceState, TraceVM } from '../../view-models';

const SAFETY_COPY =
  'VibeDoc cannot assess symptoms or emergencies. Do not wait for a reply. If you may be experiencing an emergency, call 911 or your local emergency number now. For other clinical concerns, contact a qualified healthcare professional.';

const providerLabels: Record<ProviderMode, string> = {
  live: 'Live voice',
  fixture: 'Deterministic fixture',
  prerecorded: 'Prerecorded replay',
};

type PublicAccessShellProps = Readonly<{
  state: PublicSurfaceState;
  providerMode: ProviderMode;
  traceContextKey: string;
  traces: readonly TraceVM[];
  onSubmit: (message: string) => void;
}>;

export function PublicAccessShell({
  state,
  providerMode,
  traceContextKey,
  traces,
  onSubmit,
}: PublicAccessShellProps): React.JSX.Element {
  const [message, setMessage] = useState('');

  if (state !== 'ready' && state !== 'stopped') {
    return (
      <ShellFrame shell="public" eyebrow="VibeDoc front desk" title="One request. One ready visit.">
        <SurfaceStatePanel
          state={state}
          labels={{
            error: 'The front desk is temporarily unavailable. Continue with the deterministic demo later.',
            forbidden: 'This demo session cannot access that workspace.',
            loading: 'Loading the front desk…',
            empty: 'No conversation has started.',
          }}
        />
      </ShellFrame>
    );
  }

  return (
    <ShellFrame shell="public" eyebrow="VibeDoc front desk" title="One request. One ready visit.">
      <section className="vd-public-panel" aria-labelledby="front-desk-title">
        <h2 id="front-desk-title">Talk or type with the front desk</h2>
        <p>
          This is an automated administrative assistant for scheduling, forms, coverage responses,
          and approved clinic questions.
        </p>
        <p className="vd-source-label">Source: <span>{providerLabels[providerMode]}</span></p>
        {state === 'stopped' ? (
          <section className="vd-safety-stop" role="alert">
            <h3>Clinical content received — not assessed</h3>
            <p>{SAFETY_COPY}</p>
          </section>
        ) : (
          <form
            className="vd-composer"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = message.trim();
              if (normalized.length > 0) onSubmit(normalized);
            }}
          >
            <label htmlFor="front-desk-message">Message the front desk</label>
            <textarea
              id="front-desk-message"
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
            />
            <div className="vd-actions">
              <button type="submit" className="patient-target">
                Send request
              </button>
              <button type="button" className="patient-target" aria-label="Talk to the front desk">
                Talk to the front desk
              </button>
            </div>
          </form>
        )}
        <FunctionTraceGroup contextKey={traceContextKey} traces={traces} />
      </section>
    </ShellFrame>
  );
}
