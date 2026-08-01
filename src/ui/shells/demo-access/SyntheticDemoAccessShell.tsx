import { ShellFrame } from '../../components/ShellFrame';
import { SurfaceStatePanel } from '../../components/SurfaceStatePanel';
import type { DemoPersona, SurfaceState } from '../../view-models';

type SyntheticDemoAccessShellProps = Readonly<{
  state: SurfaceState;
  onSelectPersona: (persona: DemoPersona) => void;
}>;

export function SyntheticDemoAccessShell({
  state,
  onSelectPersona,
}: SyntheticDemoAccessShellProps): React.JSX.Element {
  if (state !== 'ready') {
    return (
      <ShellFrame shell="demo" eyebrow="Demo gateway" title="Synthetic Demo Access">
        <SurfaceStatePanel
          state={state}
          labels={{
            loading: 'Preparing fictional personas…',
            empty: 'No fictional personas are configured.',
            error: 'Synthetic Demo Access is temporarily unavailable.',
            forbidden: 'This session cannot create a demo persona.',
          }}
        />
      </ShellFrame>
    );
  }

  return (
    <ShellFrame shell="demo" eyebrow="Demo gateway" title="Synthetic Demo Access">
      <section className="vd-demo-access" aria-labelledby="persona-title">
        <h2 id="persona-title">Choose a fictional workspace</h2>
        <p>This is a persona selector, not authentication. It contains no real patient information.</p>
        <div className="vd-persona-grid">
          <button type="button" className="patient-target" onClick={() => onSelectPersona('maria-demo')}>
            Continue as Maria Lopez · synthetic patient
          </button>
          <button type="button" onClick={() => onSelectPersona('maya-demo')}>
            Continue as Dr. Maya Chen · synthetic physician
          </button>
        </div>
      </section>
    </ShellFrame>
  );
}
