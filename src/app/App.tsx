import { useEffect, useState } from 'react';
import { resolveShell } from './routes';
import { PatientWorkspaceShell } from '../ui/shells/patient-workspace/PatientWorkspaceShell';
import { PhysicianCockpitShell } from '../ui/shells/physician-cockpit/PhysicianCockpitShell';
import { PublicAccessShell } from '../ui/shells/public-access/PublicAccessShell';
import { SyntheticDemoAccessShell } from '../ui/shells/demo-access/SyntheticDemoAccessShell';
import { completedBookingTrace, physicianVisits } from '../ui/fixtures/presentation';
import type { DemoWorkflowSnapshot } from '../server/demo-workflow-store';
import type { ExceptionVM, PhysicianVisitVM } from '../ui/view-models';
import type { SessionContext } from '../contracts/session';

type ClientSession = Omit<SessionContext, 'sessionId'>;

async function readSnapshot(): Promise<DemoWorkflowSnapshot> {
  const response = await fetch('/api/demo/state', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load demo state');
  return await response.json() as DemoWorkflowSnapshot;
}

async function bootstrapSession(path: '/api/session/public' | '/api/session/demo'): Promise<ClientSession> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to create demo session');
  return await response.json() as ClientSession;
}

async function readCurrentSession(): Promise<ClientSession> {
  const response = await fetch('/api/session/current', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('A role-bound demo session is required');
  return await response.json() as ClientSession;
}

async function mutateSnapshot(path: string, body: Record<string, string>, csrfToken: string): Promise<DemoWorkflowSnapshot> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Demo mutation was rejected');
  return await response.json() as DemoWorkflowSnapshot;
}

export function App(): React.JSX.Element {
  const shell = resolveShell(window.location.pathname);
  const [snapshot, setSnapshot] = useState<DemoWorkflowSnapshot>();
  const [session, setSession] = useState<ClientSession>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const initialize = async (): Promise<void> => {
      if (shell === 'public') setSession(await bootstrapSession('/api/session/public'));
      if (shell === 'demo') {
        setSession(await bootstrapSession('/api/session/demo'));
        return;
      }
      const current = await readCurrentSession();
      const expectedRole = shell === 'patient' ? 'patient-demo' : 'physician-demo';
      if (current.role !== expectedRole) {
        setAccessDenied(true);
        return;
      }
      setSession(current);
      setSnapshot(await readSnapshot());
    };
    void initialize().catch(() => setLoadFailed(true));
  }, [shell]);

  useEffect(() => {
    if (shell === 'public' && session) void readSnapshot().then(setSnapshot).catch(() => setLoadFailed(true));
  }, [session, shell]);

  if (shell === 'demo') {
    return (
      <SyntheticDemoAccessShell
        state={loadFailed ? 'error' : session ? 'ready' : 'loading'}
        onSelectPersona={(persona) => {
          if (!session) return;
          void fetch('/api/session/transition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken },
            body: JSON.stringify({ persona }),
          }).then((response) => {
            if (!response.ok) throw new Error('Persona transition failed');
            window.location.assign(persona === 'maria-demo' ? '/patient/visit' : '/physician/inbox');
          }).catch(() => setLoadFailed(true));
        }}
      />
    );
  }

  if (shell === 'patient') {
    return (
      <PatientWorkspaceShell
        state={accessDenied ? 'forbidden' : loadFailed ? 'error' : snapshot ? snapshot.visit ? 'ready' : 'empty' : 'loading'}
        visit={snapshot?.visit ?? physicianVisits[0]}
        onSubmitMemberId={(memberId) => {
          if (!session) return;
          void mutateSnapshot('/api/demo/member-id', { memberId }, session.csrfToken).then(setSnapshot).catch(() => setLoadFailed(true));
        }}
      />
    );
  }

  if (shell === 'physician') {
    const visits: PhysicianVisitVM[] = snapshot?.visit ? (() => {
      const base = physicianVisits[0];
      if (snapshot.visit.status === 'ready') return [{ ...base, ...snapshot.visit, sourceLabel: 'Medplum · deterministic fixture' }];
      return [{
        ...base,
        ...snapshot.visit,
        sourceLabel: 'Medplum · deterministic fixture',
        evidenceResources: base.evidenceResources.filter((item) => [
          'booking-record', 'patient-reported-intake', 'coverage-record', 'follow-up-request', 'delivered-follow-up',
        ].includes(item.workflowRole)),
        resolvedTaskHistory: undefined,
        eligibilityLinkage: undefined,
      }];
    })() : [];
    const exceptions: ExceptionVM[] = (snapshot?.exceptions ?? []).map((exception) => ({
      id: exception.id,
      category: exception.category === 'mixed-clinical-administrative'
        ? 'clinical-language'
        : exception.category === 'administrative-unmatched' || exception.category === 'privacy'
          ? 'provider-failure'
          : exception.category,
      safeSubjectLabel: 'Unverified demo session',
      ownerDisplay: 'Dr. Maya Chen',
      dueAt: '2026-08-01T17:00:00-05:00',
      status: exception.status,
      acknowledged: false,
      reason: 'Automation stopped without revealing patient information.',
    }));
    return (
      <PhysicianCockpitShell
        state={accessDenied ? 'forbidden' : loadFailed ? 'error' : snapshot ? visits.length > 0 ? 'ready' : 'empty' : 'loading'}
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
      stopCopy={snapshot?.stopCopy}
      stopHeading={snapshot?.exceptions[0]?.category === 'identity' ? 'Identity could not be confirmed' : undefined}
      onRunUncertainIdentity={() => {
        if (!session) return;
        void mutateSnapshot('/api/demo/identity-replay', {}, session.csrfToken).then(setSnapshot).catch(() => setLoadFailed(true));
      }}
      identityVerified={snapshot?.identityVerified ?? false}
      onSubmitIdentity={(identity) => {
        if (!session) return;
        void mutateSnapshot('/api/demo/identity', identity, session.csrfToken).then(setSnapshot).catch(() => setLoadFailed(true));
      }}
      onSubmit={(message) => {
        if (!session) return;
        void mutateSnapshot('/api/demo/request', { message }, session.csrfToken).then(setSnapshot).catch(() => setLoadFailed(true));
      }}
    />
  );
}
