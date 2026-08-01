import { useCallback, useEffect, useRef, useState } from 'react';
import { ExceptionInbox } from '../../components/ExceptionInbox';
import { EvidenceInspector } from '../../components/EvidenceInspector';
import { ReadyVisitRail } from '../../components/ReadyVisitRail';
import { ShellFrame } from '../../components/ShellFrame';
import { SurfaceStatePanel } from '../../components/SurfaceStatePanel';
import type { ExceptionVM, PhysicianVisitVM, SurfaceState } from '../../view-models';

type PhysicianCockpitShellProps = Readonly<{
  state: SurfaceState;
  visits: readonly PhysicianVisitVM[];
  exceptions: readonly ExceptionVM[];
  onOpenVisit: (appointmentBusinessId: string) => void;
  onAcknowledgeException: (exceptionId: string) => void;
}>;

export function PhysicianCockpitShell({
  state,
  visits,
  exceptions,
  onOpenVisit,
  onAcknowledgeException,
}: PhysicianCockpitShellProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showExceptions, setShowExceptions] = useState(false);
  const cockpitRef = useRef<HTMLDivElement>(null);

  const handleShortcut = useCallback((event: KeyboardEvent) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === 'j') {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, visits.length - 1));
    } else if (event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
    } else if (event.key.toLowerCase() === 'e') {
      event.preventDefault();
      setShowExceptions(true);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = visits[selectedIndex];
      if (selected) onOpenVisit(selected.appointmentBusinessId);
    }
  }, [onOpenVisit, selectedIndex, visits]);

  useEffect(() => {
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [handleShortcut]);

  if (state !== 'ready') {
    return (
      <ShellFrame shell="physician" eyebrow="Dr. Maya Chen" title="Physician cockpit">
        {state === 'empty' ? (
          <SurfaceStatePanel state="empty" labels={{ empty: 'No scheduled visits' }} />
        ) : (
          <SurfaceStatePanel
            state={state}
            labels={{
              loading: 'Loading physician workspace…',
              error: 'Unable to load the physician workspace.',
              forbidden: 'Physician access is required.',
              stale: 'This physician queue is stale. Refresh before acting.',
            }}
          />
        )}
      </ShellFrame>
    );
  }

  const selectedVisit = visits[selectedIndex];
  if (!selectedVisit) {
    return (
      <ShellFrame shell="physician" eyebrow="Dr. Maya Chen" title="Physician cockpit">
        <SurfaceStatePanel state="empty" labels={{ empty: 'No scheduled visits' }} />
      </ShellFrame>
    );
  }

  return (
    <ShellFrame shell="physician" eyebrow="Dr. Maya Chen" title="Physician cockpit">
      <div
        ref={cockpitRef}
        className="vd-cockpit"
        role="application"
        aria-label="Physician cockpit"
        tabIndex={0}
      >
        <nav className="vd-cockpit__queue" aria-label="Tomorrow appointments">
          <div className="vd-cockpit__queue-heading">
            <h2>Tomorrow</h2>
            <button type="button" onClick={() => setShowExceptions(true)}>
              Exceptions ({exceptions.length})
            </button>
          </div>
          <ul className="vd-list-reset">
            {visits.map((visit, index) => (
              <li key={visit.appointmentBusinessId} aria-current={index === selectedIndex ? 'true' : undefined}>
                <button type="button" onClick={() => setSelectedIndex(index)}>
                  <span>{visit.patientDisplay}</span>
                  <span>{visit.status === 'ready' ? '✓ Ready' : '! Needs attention'}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="vd-cockpit__workspace" aria-labelledby="workspace-title">
          <p className="vd-eyebrow">Suggested next visit</p>
          <h2 id="workspace-title">{selectedVisit.patientDisplay}</h2>
          <p>Selection is read-only until you choose Open visit. No recording is active.</p>
          <ReadyVisitRail visit={selectedVisit} />
          <button type="button" onClick={() => onOpenVisit(selectedVisit.appointmentBusinessId)}>
            Open visit
          </button>
        </section>

        <aside className="vd-cockpit__evidence" aria-label="Physician evidence and exceptions">
          {showExceptions ? (
            <ExceptionInbox exceptions={exceptions} onAcknowledge={onAcknowledgeException} />
          ) : (
            <EvidenceInspector visit={selectedVisit} />
          )}
        </aside>
      </div>
    </ShellFrame>
  );
}
