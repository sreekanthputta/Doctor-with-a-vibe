import { useState } from 'react';
import type { ReadyVisitVM } from '../../../contracts/ready-visit';
import { ReadyVisitRail } from '../../components/ReadyVisitRail';
import { ShellFrame } from '../../components/ShellFrame';
import { SurfaceStatePanel } from '../../components/SurfaceStatePanel';
import type { SurfaceState } from '../../view-models';

type PatientWorkspaceShellProps = Readonly<{
  state: SurfaceState;
  visit: ReadyVisitVM;
  onSubmitMemberId: (memberId: string) => void;
}>;

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Chicago',
});

export function PatientWorkspaceShell({
  state,
  visit,
  onSubmitMemberId,
}: PatientWorkspaceShellProps): React.JSX.Element {
  const [memberId, setMemberId] = useState('');

  if (state !== 'ready') {
    return (
      <ShellFrame shell="patient" eyebrow="Maria Lopez · synthetic patient" title="Prepare for your visit">
        <SurfaceStatePanel
          state={state}
          labels={{
            loading: 'Loading patient workspace…',
            empty: 'No upcoming appointment is available.',
            error: 'Unable to load the patient workspace.',
            forbidden: 'Patient demo access is required.',
            stale: 'This readiness view is stale. Refresh before submitting information.',
          }}
        />
      </ShellFrame>
    );
  }

  const needsMemberId = visit.openRequiredTaskCount > 0;
  return (
    <ShellFrame shell="patient" eyebrow="Maria Lopez · synthetic patient" title="Prepare for your visit">
      <ReadyVisitRail visit={visit} />
      <div className="vd-patient-grid">
        <section className="vd-panel" aria-labelledby="intake-title">
          <h2 id="intake-title">Intake and coverage response</h2>
          {needsMemberId ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const normalized = memberId.trim();
                if (normalized.length > 0) onSubmitMemberId(normalized);
              }}
            >
              <h3>Insurance member ID required</h3>
              <p>Eligibility has not run yet.</p>
              <label htmlFor="member-id">Insurance member ID</label>
              <input
                id="member-id"
                value={memberId}
                onChange={(event) => setMemberId(event.currentTarget.value)}
              />
              <button type="submit" className="patient-target">
                Submit member ID
              </button>
            </form>
          ) : (
            <dl>
              <div><dt>Eligibility transaction</dt><dd>Response received</dd></div>
              <div><dt>Benefits not supplied by payer</dt><dd>Unknown / not checked</dd></div>
            </dl>
          )}
        </section>
        <aside className="vd-panel" aria-labelledby="source-title">
          <h2 id="source-title">Sources</h2>
          <p>Source updated {timestampFormatter.format(new Date(visit.sourceUpdatedAt))}</p>
          <p>Medplum · deterministic fixture</p>
          <p>
            Provenance {visit.provenanceState === 'confirmed' ? 'confirmed' : visit.provenanceState}
          </p>
        </aside>
      </div>
    </ShellFrame>
  );
}
