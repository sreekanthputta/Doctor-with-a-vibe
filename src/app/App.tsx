import { useEffect, useState } from 'react';
import { resolveShell } from './routes';
import { PatientWorkspaceShell } from '../ui/shells/patient-workspace/PatientWorkspaceShell';
import { PhysicianCockpitShell } from '../ui/shells/physician-cockpit/PhysicianCockpitShell';
import { PublicAccessShell } from '../ui/shells/public-access/PublicAccessShell';
import { SyntheticDemoAccessShell } from '../ui/shells/demo-access/SyntheticDemoAccessShell';
import { bookingTrace, physicianVisits } from '../ui/fixtures/presentation';
import type { DemoWorkflowSnapshot } from '../server/demo-workflow-store';
import type { ExceptionVM, PhysicianVisitVM, TraceVM } from '../ui/view-models';
import type { SessionContext } from '../contracts/session';
import { TracePresentationSchema, type TracePresentation } from '../contracts/trace';
import { projectPersistedWorkflowEvidence } from '../ui/mappers/evidence-presentation';

type ClientSession = Omit<SessionContext, 'sessionId'>;

async function readSnapshot(): Promise<DemoWorkflowSnapshot> {
  const response = await fetch('/api/demo/state', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load demo state');
  return await response.json() as DemoWorkflowSnapshot;
}

async function readTraceSnapshots(): Promise<TracePresentation[]> {
  const response = await fetch('/api/traces', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load function traces');
  return TracePresentationSchema.array().parse(await response.json());
}

function presentBookingTraces(
  traces: readonly TracePresentation[],
  providerMode: DemoWorkflowSnapshot['providerMode'],
): TraceVM[] {
  return traces
    .filter((trace) => trace.toolName === 'book_appointment')
    .map((trace) => {
      const startedAt = trace.startedAt ? Date.parse(trace.startedAt) : Number.NaN;
      const completedAt = trace.completedAt ? Date.parse(trace.completedAt) : Number.NaN;
      const durationMs = Number.isFinite(startedAt) && Number.isFinite(completedAt)
        ? Math.max(0, completedAt - startedAt)
        : undefined;
      return {
        ...trace,
        displayName: 'Book appointment',
        providerMode,
        ...(durationMs === undefined ? {} : { durationMs }),
      };
    });
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
  const [publicTraces, setPublicTraces] = useState<TraceVM[]>([]);

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
    if (shell === 'public' && session) {
      void Promise.all([readSnapshot(), readTraceSnapshots()])
        .then(([nextSnapshot, nextTraces]) => {
          setSnapshot(nextSnapshot);
          setPublicTraces(presentBookingTraces(nextTraces, nextSnapshot.providerMode));
        })
        .catch(() => setLoadFailed(true));
    }
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
        sourceLabel={snapshot?.providerMode === 'live' ? 'Medplum · live committed resources' : 'Synthetic deterministic FHIR fixture'}
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
      const evidence = projectPersistedWorkflowEvidence({
        evidence: snapshot.resourceEvidence,
        conversation: 'deterministic-typed',
        persistence: snapshot.providerMode === 'live' ? 'medplum-live' : 'medplum-fixture',
        workflowStatus: snapshot.visit.status,
        taskOwnerDisplay: 'Dr. Maya Chen',
      });
      return [{
        ...base,
        ...snapshot.visit,
        ...evidence,
        sourceLabel: evidence.sourceModes.persistence.label,
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
      acknowledged: exception.status === 'accepted',
      reason: 'Automation stopped without revealing patient information.',
    }));
    return (
      <PhysicianCockpitShell
        state={accessDenied ? 'forbidden' : loadFailed ? 'error' : snapshot ? visits.length > 0 ? 'ready' : 'empty' : 'loading'}
        visits={visits}
        exceptions={exceptions}
        onOpenVisit={() => undefined}
        onAcknowledgeException={(exceptionId) => {
          if (!session) return;
          void mutateSnapshot(`/api/demo/exceptions/${encodeURIComponent(exceptionId)}/acknowledge`, {}, session.csrfToken)
            .then(setSnapshot)
            .catch(() => setLoadFailed(true));
        }}
      />
    );
  }

  return (
    <PublicAccessShell
      state={loadFailed ? 'error' : snapshot?.phase === 'stopped' ? 'stopped' : snapshot ? 'ready' : 'loading'}
      providerMode={snapshot?.providerMode ?? 'fixture'}
      traceContextKey={`public:${snapshot?.phase ?? 'loading'}`}
      traces={publicTraces}
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
        const startedAt = new Date().toISOString();
        const localRunningTrace: TraceVM = {
          ...bookingTrace,
          toolName: 'book_appointment',
          startedAt,
          providerMode: snapshot?.providerMode ?? 'fixture',
          safeInput: { slotDisplay: 'Tuesday morning' },
        };
        setPublicTraces([localRunningTrace]);
        void mutateSnapshot('/api/demo/request', { message }, session.csrfToken)
          .then(async (next) => {
            setSnapshot(next);
            try {
              const traces = await readTraceSnapshots();
              setPublicTraces(presentBookingTraces(traces, next.providerMode));
            } catch {
              setPublicTraces([{ ...localRunningTrace, status: 'reconciling', providerMode: next.providerMode }]);
            }
          })
          .catch(() => {
            setPublicTraces([{ ...localRunningTrace, status: 'reconciling' }]);
          });
      }}
    />
  );
}
