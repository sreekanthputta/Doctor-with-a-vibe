import { useState } from 'react';
import { resolveShell } from './routes';
import { PatientWorkspaceShell } from '../ui/shells/patient-workspace/PatientWorkspaceShell';
import { PhysicianCockpitShell } from '../ui/shells/physician-cockpit/PhysicianCockpitShell';
import { PublicAccessShell } from '../ui/shells/public-access/PublicAccessShell';
import { SyntheticDemoAccessShell } from '../ui/shells/demo-access/SyntheticDemoAccessShell';
import {
  completedBookingTrace,
  needsAttentionVisit,
  physicianVisits,
  readyVisit,
  uncertainIdentityException,
} from '../ui/fixtures/presentation';

export function App(): React.JSX.Element {
  const shell = resolveShell(window.location.pathname);
  const [patientVisit, setPatientVisit] = useState(needsAttentionVisit);
  const [lastPublicMessage, setLastPublicMessage] = useState('');

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
        state="ready"
        visit={patientVisit}
        onSubmitMemberId={(memberId) => {
          if (memberId === 'AETNA-DEMO-2048') setPatientVisit(readyVisit);
        }}
      />
    );
  }

  if (shell === 'physician') {
    return (
      <PhysicianCockpitShell
        state="ready"
        visits={physicianVisits}
        exceptions={[uncertainIdentityException]}
        onOpenVisit={() => undefined}
        onAcknowledgeException={() => undefined}
      />
    );
  }

  return (
    <PublicAccessShell
      state="ready"
      providerMode="fixture"
      traceContextKey={`public:${lastPublicMessage}`}
      traces={lastPublicMessage ? [completedBookingTrace] : []}
      onSubmit={setLastPublicMessage}
    />
  );
}
