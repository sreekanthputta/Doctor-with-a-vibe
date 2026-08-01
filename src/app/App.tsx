import { useEffect, useState } from 'react';
import { resolveShell } from './routes';
import { PatientWorkspaceShell } from '../ui/shells/patient-workspace/PatientWorkspaceShell';
import { PhysicianCockpitShell } from '../ui/shells/physician-cockpit/PhysicianCockpitShell';
import { PublicAccessShell } from '../ui/shells/public-access/PublicAccessShell';
import { SyntheticDemoAccessShell } from '../ui/shells/demo-access/SyntheticDemoAccessShell';
import { completedBookingTrace, physicianVisits } from '../ui/fixtures/presentation';
import type { DemoWorkflowSnapshot } from '../server/demo-workflow-store';
import type { ExceptionVM, PhysicianVisitVM } from '../ui/view-models';

async function readSnapshot(): Promise<DemoWorkflowSnapshot> {
  const response = await fetch('/api/demo/state', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load demo state');
  return await response.json() as DemoWorkflowSnapshot;
}

async function mutateSnapshot(path: string, body: Record<string, string>): Promise<DemoWorkflowSnapshot> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Demo mutation was rejected');
  return await response.json() as DemoWorkflowSnapshot;
}

export function App(): React.JSX.Element {
  const shell = resolveShell(window.location.pathname);
  const [snapshot, setSnapshot] = useState<DemoWorkflowSnapshot>();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    void readSnapshot().then(setSnapshot).catch(() => setLoadFailed(true));
  }, []);

  if (shell === 'demo') {
    return (
      <SyntheticDemoAccessShell
        state="ready"
        onSelectPersona={(persona) => {
          window.location.assign(persona === 'maria-demo' ? '/patient/visit' : '/physician/inbox');
        }}
      />
    );
  }

  if (shell === 'patient') {
    return (
      <PatientWorkspaceShell
        state={loadFailed ? 'error' : snapshot ? snapshot.visit ? 'ready' : 'empty' : 'loading'}
        visit={snapshot?.visit ?? physicianVisits[0]}
        onSubmitMemberId={(memberId) => {
          void mutateSnapshot('/api/demo/member-id', { memberId }).then(setSnapshot).catch(() => setLoadFailed(true));
        }}
      />
    );
  }

  if (shell === 'physician') {
    const visits: PhysicianVisitVM[] = snapshot?.visit ? [{
      ...physicianVisits[0],
      ...snapshot.visit,
      sourceLabel: 'Medplum · deterministic fixture',
      resources: snapshot.resourceEvidence.map((item) => item.resourceType),
    }] : [];
    const exceptions: ExceptionVM[] = (snapshot?.exceptions ?? []).map((exception) => ({
      id: exception.id,
      category: exception.category,
      safeSubjectLabel: 'Unverified demo session',
      ownerDisplay: 'Dr. Maya Chen',
      dueAt: '2026-08-01T17:00:00-05:00',
      status: exception.status,
      acknowledged: false,
      reason: 'Automation stopped without revealing patient information.',
    }));
    return (
      <PhysicianCockpitShell
        state={loadFailed ? 'error' : snapshot ? visits.length > 0 ? 'ready' : 'empty' : 'loading'}
        visits={visits}
        exceptions={exceptions}
        onOpenVisit={() => undefined}
        onAcknowledgeException={() => undefined}
      />
    );
  }

  return (
    <PublicAccessShell
      state={loadFailed ? 'error' : snapshot?.phase === 'stopped' ? 'stopped' : snapshot ? 'ready' : 'loading'}
      providerMode="fixture"
      traceContextKey={`public:${snapshot?.phase ?? 'loading'}`}
      traces={snapshot?.phase === 'needs-attention' || snapshot?.phase === 'ready' ? [completedBookingTrace] : []}
      onSubmit={(message) => {
        void mutateSnapshot('/api/demo/request', { message }).then(setSnapshot).catch(() => setLoadFailed(true));
      }}
    />
  );
}
