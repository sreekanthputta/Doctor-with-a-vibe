import type { ReadyVisitVM } from '../contracts/ready-visit';
import type { TracePresentation } from '../contracts/trace';

export type SurfaceState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'forbidden'
  | 'blocked'
  | 'stale';

export type PublicSurfaceState = SurfaceState | 'stopped';
export type ProviderMode = 'live' | 'fixture' | 'prerecorded';
export type DemoPersona = 'maria-demo' | 'maya-demo';

export type ExceptionVM = Readonly<{
  id: string;
  category: 'identity' | 'scheduling' | 'intake' | 'coverage' | 'clinical-language' | 'provider-failure';
  safeSubjectLabel: string;
  ownerDisplay: string;
  dueAt: string;
  status: 'requested' | 'accepted' | 'in-progress';
  acknowledged: boolean;
  reason: string;
}>;

export type WorkflowEvidenceRole =
  | 'booking-record'
  | 'patient-reported-intake'
  | 'coverage-record'
  | 'eligibility-request'
  | 'eligibility-response'
  | 'required-field-resolution'
  | 'follow-up-request'
  | 'delivered-follow-up'
  | 'version-lineage';

export type WorkflowEvidenceResourceVM = Readonly<{
  reference: string;
  businessIdentifier: string;
  versionId: string;
  sourceTimestamp: string;
  workflowRole: WorkflowEvidenceRole;
  workflowRoleLabel: string;
  linkageSummary: string;
}>;

export type ResolvedTaskHistoryVM = Readonly<{
  reference: string;
  businessIdentifier: string;
  versionId: string;
  sourceTimestamp: string;
  status: 'completed';
  ownerDisplay: string;
  resolutionSummary: string;
  linkageSummary: string;
}>;

export type EligibilityEvidenceLinkageVM = Readonly<{
  requestReference: string;
  responseReference: string;
  coverageReference: string;
  sourceTimestamp: string;
  transactionState: 'completed';
  providerMode: 'fixture' | 'live';
  summary: 'Request → Response → Coverage';
}>;

export type SanitizedSecurityEventVM = Readonly<{
  eventId: string;
  occurredAt: string;
  actorRole: 'physician-demo';
  actionClass: string;
  decision: 'allowed' | 'denied';
  correlationId: string;
  sourceLabel: 'Synthetic fixture' | 'Live application event';
}>;

export type PhysicianVisitVM = ReadyVisitVM &
  Readonly<{
    sourceLabel: string;
    evidenceResources: readonly WorkflowEvidenceResourceVM[];
    resolvedTaskHistory?: ResolvedTaskHistoryVM;
    eligibilityLinkage?: EligibilityEvidenceLinkageVM;
    securityEvent: SanitizedSecurityEventVM;
  }>;

export type TraceVM = TracePresentation &
  Readonly<{
    displayName: string;
    providerMode: ProviderMode;
    durationMs?: number;
  }>;
