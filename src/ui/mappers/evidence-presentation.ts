import type {
  ConversationExecutionMode,
  EvidenceSourceModesVM,
  EligibilityEvidenceLinkageVM,
  MedplumPersistenceMode,
  ResolvedTaskHistoryVM,
  WorkflowEvidenceResourceVM,
  WorkflowEvidenceRole,
} from '../view-models';

/** UI boundary shape intentionally mirrors persisted evidence without importing server types. */
export type PersistedResourceEvidenceInput = Readonly<{
  resourceType: string;
  reference: string;
  version: string;
  sourceUpdatedAt: string;
  workflowRole: string;
  businessIdentifier?: string;
}>;

type EvidencePresentation = Readonly<{
  role: WorkflowEvidenceRole;
  linkageSummary: string;
}>;

const presentationByWorkflowRole: Readonly<Record<string, EvidencePresentation>> = {
  Identity: {
    role: 'identity-record',
    linkageSummary: 'Patient identity record bound to this verified synthetic workflow.',
  },
  Scheduling: {
    role: 'booking-record',
    linkageSummary: 'Appointment persisted for the selected workflow slot.',
  },
  Coverage: {
    role: 'coverage-record',
    linkageSummary: 'Coverage record linked to the verified synthetic patient.',
  },
  'Patient-reported intake': {
    role: 'patient-reported-intake',
    linkageSummary: 'Patient-reported intake response for this appointment workflow.',
  },
  'Owned exception': {
    role: 'required-field-resolution',
    linkageSummary: 'Owned Task recording the required-field workflow state.',
  },
  'Eligibility input': {
    role: 'eligibility-request',
    linkageSummary: 'Eligibility request linked to the workflow Coverage record.',
  },
  'Eligibility evidence': {
    role: 'eligibility-response',
    linkageSummary: 'Eligibility response linked to its persisted request.',
  },
  'Follow-up request': {
    role: 'follow-up-request',
    linkageSummary: 'Administrative follow-up request linked to the owned Task.',
  },
  'Delivered follow-up': {
    role: 'delivered-follow-up',
    linkageSummary: 'Persisted record of the in-app administrative follow-up delivery.',
  },
  'Version lineage': {
    role: 'version-lineage',
    linkageSummary: 'FHIR Provenance targeting an exact committed resource version.',
  },
};

const fallbackPresentation: EvidencePresentation = {
  role: 'version-lineage',
  linkageSummary: 'Persisted workflow evidence returned by the authorized source.',
};

/**
 * Converts persistence evidence into display data without replacing authoritative values.
 * Reference, version, timestamp, role label, and any supplied identifier remain verbatim.
 */
export function mapPersistedResourceEvidence(
  evidence: PersistedResourceEvidenceInput,
): WorkflowEvidenceResourceVM {
  const presentation = presentationByWorkflowRole[evidence.workflowRole] ?? fallbackPresentation;
  return {
    reference: evidence.reference,
    ...(evidence.businessIdentifier === undefined
      ? {}
      : { businessIdentifier: evidence.businessIdentifier }),
    versionId: evidence.version,
    sourceTimestamp: evidence.sourceUpdatedAt,
    workflowRole: presentation.role,
    workflowRoleLabel: evidence.workflowRole,
    linkageSummary: presentation.linkageSummary,
  };
}

const conversationLabels: Readonly<Record<ConversationExecutionMode, string>> = {
  'deterministic-typed': 'Deterministic typed conversation',
  'deepgram-live': 'Deepgram live conversation',
  prerecorded: 'Prerecorded conversation replay',
};

const persistenceLabels: Readonly<Record<MedplumPersistenceMode, string>> = {
  'medplum-live': 'Medplum live committed resources',
  'medplum-fixture': 'Deterministic Medplum-shaped fixture',
};

export function buildEvidenceSourceModes(input: Readonly<{
  conversation: ConversationExecutionMode;
  persistence: MedplumPersistenceMode;
}>): EvidenceSourceModesVM {
  return {
    conversation: {
      mode: input.conversation,
      label: conversationLabels[input.conversation],
    },
    persistence: {
      mode: input.persistence,
      label: persistenceLabels[input.persistence],
    },
  };
}

export type PersistedWorkflowEvidenceProjection = Readonly<{
  evidenceResources: readonly WorkflowEvidenceResourceVM[];
  sourceModes: EvidenceSourceModesVM;
  resolvedTaskHistory?: ResolvedTaskHistoryVM;
  eligibilityLinkage?: EligibilityEvidenceLinkageVM;
}>;

export function projectPersistedWorkflowEvidence(input: Readonly<{
  evidence: readonly PersistedResourceEvidenceInput[];
  conversation: ConversationExecutionMode;
  persistence: MedplumPersistenceMode;
  workflowStatus: 'needs-attention' | 'ready';
  taskOwnerDisplay: string;
}>): PersistedWorkflowEvidenceProjection {
  const evidenceResources = input.evidence.map(mapPersistedResourceEvidence);
  const task = input.evidence.find((item) => item.workflowRole === 'Owned exception');
  const request = input.evidence.find((item) => item.workflowRole === 'Eligibility input');
  const response = input.evidence.find((item) => item.workflowRole === 'Eligibility evidence');
  const coverage = input.evidence.find((item) => item.workflowRole === 'Coverage');

  const resolvedTaskHistory = input.workflowStatus === 'ready' && task ? {
    reference: task.reference,
    ...(task.businessIdentifier === undefined ? {} : { businessIdentifier: task.businessIdentifier }),
    versionId: task.version,
    sourceTimestamp: task.sourceUpdatedAt,
    status: 'completed' as const,
    ownerDisplay: input.taskOwnerDisplay,
    resolutionSummary: 'Required administrative member-ID field resolved.',
    linkageSummary: 'Coverage updated → eligibility evidence persisted → original Task completed.',
  } : undefined;

  const eligibilityLinkage = input.workflowStatus === 'ready' && request && response && coverage ? {
    requestReference: request.reference,
    responseReference: response.reference,
    coverageReference: coverage.reference,
    sourceTimestamp: response.sourceUpdatedAt,
    transactionState: 'completed' as const,
    providerMode: input.persistence === 'medplum-live' ? 'live' as const : 'fixture' as const,
    summary: 'Request → Response → Coverage' as const,
  } : undefined;

  return {
    evidenceResources,
    sourceModes: buildEvidenceSourceModes({
      conversation: input.conversation,
      persistence: input.persistence,
    }),
    ...(resolvedTaskHistory === undefined ? {} : { resolvedTaskHistory }),
    ...(eligibilityLinkage === undefined ? {} : { eligibilityLinkage }),
  };
}
