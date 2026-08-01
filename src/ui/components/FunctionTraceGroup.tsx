import { useMemo, useState } from 'react';
import type { TraceVM } from '../view-models';

type FunctionTraceGroupProps = Readonly<{
  contextKey: string;
  traces: readonly TraceVM[];
}>;

function displayStatus(status: TraceVM['status']): string {
  return status === 'succeeded' ? 'completed' : status;
}

function statusSymbol(status: TraceVM['status']): string {
  if (status === 'succeeded') return '✓';
  if (status === 'failed' || status === 'blocked') return '!';
  if (status === 'queued') return '○';
  return '●';
}

function SafeProjection({ value }: Readonly<{ value: Record<string, unknown> }>): React.JSX.Element {
  return (
    <dl className="vd-trace__projection">
      {Object.entries(value).map(([key, item]) => (
        <div key={key} className="vd-trace__field">
          <dt>{key}</dt>
          <dd>{typeof item === 'string' || typeof item === 'number' ? String(item) : 'Unavailable'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FunctionTraceGroup({ contextKey, traces }: FunctionTraceGroupProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<Readonly<{ contextKey: string; traceId: string }> | null>(null);

  const latestUpdate = useMemo(() => {
    const latest = traces.at(-1);
    return latest ? `${latest.displayName} ${displayStatus(latest.status)}` : 'No actions';
  }, [traces]);

  if (traces.length === 0) return <></>;

  return (
    <section className="vd-trace" aria-label={`${traces.length} actions`}>
      <p className="vd-trace__count">{traces.length} {traces.length === 1 ? 'action' : 'actions'}</p>
      <div className="vd-visually-hidden" role="status" aria-live="polite">
        {latestUpdate}
      </div>
      {traces.map((trace) => {
        const isExpanded = expanded?.contextKey === contextKey && expanded.traceId === trace.traceId;
        const status = displayStatus(trace.status);
        const panelId = `trace-panel-${trace.traceId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        return (
          <article className={`vd-trace__item vd-trace__item--${status}`} key={trace.traceId}>
            <button
              type="button"
              className="vd-trace__toggle"
              aria-expanded={isExpanded}
              aria-controls={panelId}
              onClick={() => setExpanded(isExpanded ? null : { contextKey, traceId: trace.traceId })}
            >
              <span aria-hidden="true">{statusSymbol(trace.status)}</span>
              <span>{trace.displayName}</span>
              <span>{status}</span>
              {trace.durationMs === undefined ? null : <span>{trace.durationMs} ms</span>}
            </button>
            {isExpanded ? (
              <div id={panelId} className="vd-trace__details">
                <p>Status: {status}</p>
                <p>Source: <span>{trace.providerMode}</span></p>
                {trace.startedAt ? <p>Started: {trace.startedAt}</p> : null}
                {trace.completedAt ? <p>Completed: {trace.completedAt}</p> : null}
                {trace.safeInput ? (
                  <section aria-label="Sanitized input">
                    <h4>Input (sanitized)</h4>
                    <SafeProjection value={trace.safeInput} />
                  </section>
                ) : null}
                <section aria-label="Sanitized output">
                  <h4>Output (sanitized)</h4>
                  {trace.safeOutput ? (
                    <SafeProjection value={trace.safeOutput} />
                  ) : trace.status === 'blocked' ? (
                    <p>Blocked · no change confirmed</p>
                  ) : trace.status === 'reconciling' ? (
                    <p>Reconciling with Medplum</p>
                  ) : (
                    <p>Waiting for scheduling adapter…</p>
                  )}
                </section>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
