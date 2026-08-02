import type { ReadyVisitVM } from '../../contracts/ready-visit';
import { isVisitReady } from '../readiness';

type ReadyVisitRailProps = Readonly<{ visit: ReadyVisitVM }>;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Chicago',
});

export function ReadyVisitRail({ visit }: ReadyVisitRailProps): React.JSX.Element {
  const isReady = isVisitReady(visit);
  const status = isReady ? 'Ready' : 'Needs attention';

  return (
    <section
      className={`vd-ready-rail vd-ready-rail--${isReady ? 'ready' : 'attention'}`}
      aria-label={`${status} visit`}
    >
      <div className="vd-ready-rail__summary">
        <span className="vd-ready-rail__icon" aria-hidden="true">{isReady ? '✓' : '!'}</span>
        <div>
          <p className="vd-eyebrow">Visit readiness</p>
          <strong role="status" aria-live="polite">
            {status}
          </strong>
        </div>
      </div>
      <p>{dateFormatter.format(new Date(visit.startsAt))}</p>
      <p>{visit.physicianDisplay} · Adult annual-wellness visit</p>
      <ol className="vd-ready-rail__steps" aria-label="Ready visit progress">
        <li><span aria-hidden="true">✓ </span><span>Appointment booked</span></li>
        <li><span aria-hidden="true">✓ </span><span>Contact details received</span></li>
        <li>
          <span aria-hidden="true">{isReady ? '✓ ' : '○ '}</span>
          <span>{isReady ? 'Coverage response received' : 'Coverage response not run'}</span>
        </li>
        <li>
          <span aria-hidden="true">{isReady ? '✓ ' : '! '}</span>
          <span>{isReady ? 'Insurance member ID received' : 'Insurance member ID required'}</span>
        </li>
      </ol>
    </section>
  );
}
