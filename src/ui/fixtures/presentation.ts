import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import type { ReadyVisitVM } from '../../contracts/ready-visit';
import type {
  ExceptionVM,
  PhysicianVisitVM,
  TraceVM,
  WorkflowEvidenceResourceVM,
} from '../view-models';

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
    evidenceResources: Object.freeze([
      {
        reference: 'Appointment/appt-maria-wellness',
        businessIdentifier: 'demo-v1:appointment:maria-wellness',
        versionId: '1',
        sourceTimestamp: '2026-08-01T15:03:00-05:00',
        workflowRole: 'booking-record',
        workflowRoleLabel: 'Booking record',
        linkageSummary: 'Created from the selected 10:30 slot for this workflow.',
      },
      {
        reference: 'QuestionnaireResponse/intake-maria-wellness',
        businessIdentifier: 'demo-v1:questionnaire-response:maria-wellness',
        versionId: '2',
        sourceTimestamp: '2026-08-01T15:10:00-05:00',
        workflowRole: 'patient-reported-intake',
        workflowRoleLabel: 'Patient-reported intake',
        linkageSummary: 'Completed after the required member ID answer was supplied.',
      },
      {
        reference: 'Coverage/coverage-maria',
        businessIdentifier: 'demo-v1:coverage:maria-aetna',
        versionId: '2',
        sourceTimestamp: '2026-08-01T15:10:02-05:00',
        workflowRole: 'coverage-record',
        workflowRoleLabel: 'Coverage record',
        linkageSummary: 'References the patient-supplied synthetic policy information.',
      },
      {
        reference: 'CoverageEligibilityRequest/eligibility-request-maria',
        businessIdentifier: 'demo-v1:eligibility-request:maria-wellness',
        versionId: '1',
        sourceTimestamp: '2026-08-01T15:10:03-05:00',
        workflowRole: 'eligibility-request',
        workflowRoleLabel: 'Eligibility request',
        linkageSummary: 'Requests benefits for Coverage/coverage-maria.',
      },
      {
        reference: 'CoverageEligibilityResponse/eligibility-response-maria',
        businessIdentifier: 'demo-v1:eligibility-response:maria-wellness',
        versionId: '1',
        sourceTimestamp: '2026-08-01T15:10:04-05:00',
        workflowRole: 'eligibility-response',
        workflowRoleLabel: 'Eligibility response',
        linkageSummary: 'Responds to CoverageEligibilityRequest/eligibility-request-maria.',
      },
      {
        reference: 'Task/task-member-id',
        businessIdentifier: 'demo-v1:task:collect-maria-member-id',
        versionId: '2',
        sourceTimestamp: '2026-08-01T15:10:05-05:00',
        workflowRole: 'required-field-resolution',
        workflowRoleLabel: 'Required-field resolution',
        linkageSummary: 'Completed only after Coverage and eligibility evidence persisted.',
      },
      {
        reference: 'CommunicationRequest/member-id-follow-up',
        businessIdentifier: 'demo-v1:communication-request:member-id-follow-up',
        versionId: '1',
        sourceTimestamp: '2026-08-01T15:06:00-05:00',
        workflowRole: 'follow-up-request',
        workflowRoleLabel: 'Follow-up request',
        linkageSummary: 'Requested a privacy-minimal in-app administrative follow-up.',
      },
      {
        reference: 'Communication/member-id-follow-up-delivered',
        businessIdentifier: 'demo-v1:communication:member-id-follow-up-delivered',
        versionId: '1',
        sourceTimestamp: '2026-08-01T15:06:02-05:00',
        workflowRole: 'delivered-follow-up',
        workflowRoleLabel: 'Delivered follow-up',
        linkageSummary: 'Records delivery of the in-app follow-up request.',
      },
      {
        reference: 'Provenance/ready-visit-lineage',
        businessIdentifier: 'demo-v1:provenance:maria-ready-visit',
        versionId: '1',
        sourceTimestamp: '2026-08-01T15:10:06-05:00',
        workflowRole: 'version-lineage',
        workflowRoleLabel: 'Version lineage',
        linkageSummary: 'Targets the exact committed workflow resource versions.',
      },
    ] as const satisfies readonly WorkflowEvidenceResourceVM[]),
    resolvedTaskHistory: Object.freeze({
      reference: 'Task/task-member-id',
      businessIdentifier: 'demo-v1:task:collect-maria-member-id',
      versionId: '2',
      sourceTimestamp: '2026-08-01T15:10:05-05:00',
      status: 'completed',
      ownerDisplay: DEMO_V1.physician.display,
      resolutionSummary: 'Insurance member ID supplied; required administrative field resolved.',
      linkageSummary: 'Coverage updated → eligibility evidence persisted → original Task completed.',
    }),
    eligibilityLinkage: Object.freeze({
      requestReference: 'CoverageEligibilityRequest/eligibility-request-maria',
      responseReference: 'CoverageEligibilityResponse/eligibility-response-maria',
      coverageReference: 'Coverage/coverage-maria',
      sourceTimestamp: '2026-08-01T15:10:04-05:00',
      transactionState: 'completed',
      providerMode: 'fixture',
      summary: 'Request → Response → Coverage',
    }),
    securityEvent: Object.freeze({
      eventId: 'security-event:physician-ready-visit-read',
      occurredAt: '2026-08-01T15:12:00-05:00',
      actorRole: 'physician-demo',
      actionClass: 'ready-visit-evidence-read',
      decision: 'allowed',
      correlationId: 'correlation:ready-visit-maria',
      sourceLabel: 'Synthetic fixture',
    }),
  },
]);
