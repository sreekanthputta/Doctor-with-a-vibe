import type { SurfaceState } from '../view-models';

type SurfaceStatePanelProps = Readonly<{
  state: Exclude<SurfaceState, 'ready'>;
  labels: Readonly<Partial<Record<Exclude<SurfaceState, 'ready'>, string>>>;
}>;

const fallbackLabels: Record<Exclude<SurfaceState, 'ready'>, string> = {
  loading: 'Loading workspace…',
  empty: 'Nothing to show yet.',
  error: 'Unable to load this workspace.',
  forbidden: 'This session cannot access that workspace.',
  blocked: 'This workflow is blocked for review.',
  stale: 'This view may be out of date. Refresh before continuing.',
};

export function SurfaceStatePanel({ state, labels }: SurfaceStatePanelProps): React.JSX.Element {
  const message = labels[state] ?? fallbackLabels[state];
  const role = state === 'loading' ? 'status' : state === 'empty' ? undefined : 'alert';

  return (
    <section className={`vd-state-panel vd-state-panel--${state}`} role={role} aria-live="polite">
      <p>{message}</p>
    </section>
  );
}
