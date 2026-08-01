import type { ExceptionVM } from '../view-models';

type ExceptionInboxProps = Readonly<{
  exceptions: readonly ExceptionVM[];
  onAcknowledge: (exceptionId: string) => void;
}>;

const dueFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Chicago',
});

export function ExceptionInbox({ exceptions, onAcknowledge }: ExceptionInboxProps): React.JSX.Element {
  if (exceptions.length === 0) {
    return (
      <section className="vd-exceptions" aria-labelledby="exceptions-title">
        <h2 id="exceptions-title">Exceptions</h2>
        <p>No open exceptions</p>
      </section>
    );
  }

  return (
    <section className="vd-exceptions" aria-labelledby="exceptions-title">
      <h2 id="exceptions-title">Exceptions</h2>
      <ul className="vd-list-reset">
        {exceptions.map((exception) => (
          <li className="vd-exception" key={exception.id}>
            <p className="vd-eyebrow">{exception.category}</p>
            <h3>{exception.safeSubjectLabel}</h3>
            <p>{exception.reason}</p>
            <p>{exception.status} · {exception.acknowledged ? 'acknowledged' : 'unacknowledged'}</p>
            <p>Owner: {exception.ownerDisplay}</p>
            <p>Due: {dueFormatter.format(new Date(exception.dueAt))}</p>
            {!exception.acknowledged ? (
              <button
                type="button"
                onClick={() => onAcknowledge(exception.id)}
                aria-label={`Acknowledge ${exception.category} exception`}
              >
                Acknowledge
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
