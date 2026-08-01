import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import type { ReadyVisitVM } from '../../contracts/ready-visit';
import type { ExceptionVM, PhysicianVisitVM, TraceVM } from '../view-models';

const baseVisit = {
  appointmentBusinessId: 'demo-v1:appointment:maria-wellness',
  patientDisplay: `${DEMO_V1.patient.givenName} ${DEMO_V1.patient.familyName}`,
  physicianDisplay: DEMO_V1.physician.display,
  startsAt: DEMO_V1.selectedSlot,
  sourceUpdatedAt: '2026-08-01T15:12:00-05:00',
} as const;

export const needsAttentionVisit: ReadyVisitVM = Object.freeze({
  ...baseVisit,
  status: 'needs-attention',
  openRequiredTaskCount: 1,
  eligibilityTransaction: 'not-run',
  provenanceState: 'reconciling',
});

export const readyVisit: ReadyVisitVM = Object.freeze({
  ...baseVisit,
  status: 'ready',
  openRequiredTaskCount: 0,
  eligibilityTransaction: 'completed',
  provenanceState: 'confirmed',
});

export const bookingTrace: TraceVM = Object.freeze({
  traceId: 'trace:book-appointment',
  messageId: 'message:booking',
  toolName: 'book_demo_appointment',
  displayName: 'Book appointment',
  status: 'running',
  startedAt: '2026-08-01T15:02:41-05:00',
  providerMode: 'fixture',
  safeInput: {
    slot: 'Tuesday, August 4 · 10:30 AM',
    visitType: 'Adult annual-wellness visit',
  },
});

export const completedBookingTrace: TraceVM = Object.freeze({
  ...bookingTrace,
  status: 'succeeded',
  completedAt: '2026-08-01T15:02:41.323-05:00',
  durationMs: 323,
  safeOutput: {
    result: 'Appointment recorded',
    source: 'Medplum fixture',
  },
});

export const uncertainIdentityException: ExceptionVM = Object.freeze({
  id: 'exception:uncertain-identity',
  category: 'identity',
  safeSubjectLabel: 'Unverified demo session',
  ownerDisplay: DEMO_V1.physician.display,
  dueAt: '2026-08-01T17:00:00-05:00',
  status: 'requested',
  acknowledged: false,
  reason: 'Identity could not be confirmed without revealing patient information.',
});

export const physicianVisits: readonly PhysicianVisitVM[] = Object.freeze([
  {
    ...readyVisit,
    sourceLabel: 'Medplum · fixture',
    resources: Object.freeze([
      'Appointment',
      'QuestionnaireResponse',
      'Coverage',
      'CoverageEligibilityRequest',
      'CoverageEligibilityResponse',
      'Task',
      'CommunicationRequest',
      'Communication',
      'Provenance',
    ]),
  },
]);
