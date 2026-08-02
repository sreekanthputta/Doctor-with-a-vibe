import type { ReadyVisitVM } from '../contracts/ready-visit.js';
import { ScriptedConversationAdapter } from '../adapters/scripted-conversation.js';
import { StediEligibilityFixture } from '../adapters/stedi-eligibility-fixture.js';
import { createWorkflowState, reduceWorkflow, type DemoWorkflowState } from '../domain/workflow-reducer.js';
import { DEMO_V1 } from '../test/fixtures/demo-v1.js';
import { createStopOutcome, type StopCategory } from '../domain/exception-policy.js';
import { decideDemoIdentity } from '../domain/identity-gate.js';
import type { DemoIdentity, DemoPersistence, DemoPersistenceSnapshot } from './demo-persistence.js';

export type DemoResourceEvidence = {
  resourceType: string;
  reference: string;
  version: string;
  sourceUpdatedAt: string;
  workflowRole: string;
};

export type DemoException = {
  id: string;
  category: StopCategory;
  status: 'requested' | 'accepted';
  ownerReference: string;
};

export type DemoWorkflowSnapshot = {
  phase: 'empty' | 'needs-attention' | 'ready' | 'stopped';
  visit?: ReadyVisitVM;
  exceptions: DemoException[];
  resourceEvidence: DemoResourceEvidence[];
  stopCopy?: string;
  identityVerified: boolean;
  providerMode: 'fixture' | 'live';
};

const REQUIRED_READY_EVIDENCE = [
  'Appointment',
  'Coverage',
  'QuestionnaireResponse',
  'Task',
  'CoverageEligibilityRequest',
  'CoverageEligibilityResponse',
  'Provenance',
] as const;

const PROVIDER_FAILURE_COPY = 'VibeDoc could not complete this administrative request because its record service is unavailable. No appointment is shown as booked. The request is listed for physician follow-up.';

export class ProviderCompletionError extends Error {
  constructor() {
    super('Provider completion failed');
    this.name = 'ProviderCompletionError';
  }
}

function requirePersistedReadyEvidence(evidence: readonly DemoResourceEvidence[]): void {
  const present = new Set(evidence.map((item) => item.resourceType));
  const missing = REQUIRED_READY_EVIDENCE.filter((resourceType) => !present.has(resourceType));
  if (missing.length > 0) throw new Error(`Ready is missing required persisted evidence: ${missing.join(', ')}`);
}

export class DemoWorkflowStore {
  #domain: DemoWorkflowState = createWorkflowState('demo-v1:workflow:maria');
  #snapshot: DemoWorkflowSnapshot = { phase: 'empty', exceptions: [], resourceEvidence: [], identityVerified: false, providerMode: 'fixture' };
  #identityVerified = false;
  #verifiedIdentity?: DemoIdentity;

  constructor(
    private readonly conversation = new ScriptedConversationAdapter(),
    private readonly eligibility = new StediEligibilityFixture(),
    private readonly persistence?: DemoPersistence,
  ) {
    this.#snapshot.providerMode = this.#providerMode();
  }

  snapshot(): DemoWorkflowSnapshot {
    return structuredClone(this.#snapshot);
  }

  hydratePersisted(persisted: DemoPersistenceSnapshot): DemoWorkflowSnapshot {
    if (this.#snapshot.phase !== 'empty') return this.snapshot();
    if (persisted.phase === 'stopped') throw new Error('A stopped workflow requires an explicit exception projection');
    if (persisted.phase === 'ready') requirePersistedReadyEvidence(persisted.evidence);
    this.#identityVerified = true;
    this.#verifiedIdentity = {
      givenName: DEMO_V1.patient.givenName,
      familyName: DEMO_V1.patient.familyName,
      birthDate: DEMO_V1.patient.birthDate,
      postalCode: DEMO_V1.patient.postalCode,
    };
    this.#domain = reduceWorkflow(this.#domain, { type: 'identity-verified' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'appointment-booked' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'intake-saved', complete: false });
    if (persisted.phase === 'ready') {
      this.#domain = reduceWorkflow(this.#domain, { type: 'member-id-supplied' });
      this.#domain = reduceWorkflow(this.#domain, { type: 'coverage-updated' });
      this.#domain = reduceWorkflow(this.#domain, { type: 'eligibility-started' });
      this.#domain = reduceWorkflow(this.#domain, { type: 'eligibility-persisted', linked: true, sourceIdentifierValid: true, outcomeAccepted: true });
      this.#domain = reduceWorkflow(this.#domain, { type: 'intake-completed' });
      this.#domain = reduceWorkflow(this.#domain, { type: 'required-task-completed' });
    }
    this.#snapshot = {
      phase: persisted.phase,
      exceptions: [],
      visit: this.#visit(persisted.phase),
      resourceEvidence: persisted.evidence,
      identityVerified: true,
      providerMode: this.#providerMode(),
    };
    return this.snapshot();
  }

  hydrateException(
    persisted: DemoPersistenceSnapshot,
    exception: Pick<DemoException, 'id' | 'category' | 'status'>,
  ): DemoWorkflowSnapshot {
    if (this.#snapshot.phase !== 'empty') return this.snapshot();
    if (persisted.phase !== 'stopped' || !persisted.evidence.some((item) => item.resourceType === 'Task')) {
      throw new Error('Exception hydration requires persisted Task evidence');
    }
    this.#domain = reduceWorkflow(this.#domain, { type: 'stopped', category: exception.category });
    this.#snapshot = {
      phase: 'stopped',
      stopCopy: 'VibeDoc could not verify this synthetic identity. No patient information was disclosed.',
      resourceEvidence: persisted.evidence,
      exceptions: [{ ...exception, ownerReference: DEMO_V1.practitionerRoleReference }],
      identityVerified: false,
      providerMode: this.#providerMode(),
    };
    return this.snapshot();
  }

  async reset(): Promise<DemoWorkflowSnapshot> {
    await this.persistence?.reset();
    this.#domain = createWorkflowState('demo-v1:workflow:maria');
    this.#identityVerified = false;
    this.#verifiedIdentity = undefined;
    this.#snapshot = { phase: 'empty', exceptions: [], resourceEvidence: [], identityVerified: false, providerMode: this.#providerMode() };
    return this.snapshot();
  }

  async submitRequest(message: string): Promise<DemoWorkflowSnapshot> {
    if (this.#snapshot.phase === 'stopped') return this.snapshot();
    if (!this.#identityVerified) throw new Error('Identity verification is required before scheduling');
    const decision = await this.conversation.evaluate(message, { workflowRunId: this.#domain.workflowRunId });
    if (decision.action === 'stop') {
      const persisted = await this.persistence?.recordException(decision.category, decision.exceptionCommand.commandId);
      this.#domain = reduceWorkflow(this.#domain, { type: 'stopped', category: decision.category });
      this.#snapshot = {
        phase: 'stopped',
        resourceEvidence: persisted?.evidence ?? [],
        identityVerified: this.#identityVerified,
        providerMode: this.#providerMode(),
        stopCopy: decision.safeCopy,
        exceptions: [{
          id: decision.exceptionCommand.commandId,
          category: decision.category,
          status: 'requested',
          ownerReference: DEMO_V1.practitionerRoleReference,
        }],
      };
      return this.snapshot();
    }

    if (this.#snapshot.phase !== 'empty') return this.snapshot();
    if (!this.#verifiedIdentity) throw new Error('Verified identity details are unavailable');
    let persisted: DemoPersistenceSnapshot | undefined;
    try {
      persisted = await this.persistence?.start(this.#verifiedIdentity);
    } catch {
      return this.#stopForProviderFailure();
    }
    if (persisted?.phase === 'ready') return this.hydratePersisted(persisted);
    if (persisted && persisted.phase !== 'needs-attention') throw new Error('Persistence did not commit a supported workflow state');
    this.#domain = reduceWorkflow(this.#domain, { type: 'identity-verified' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'appointment-booked' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'intake-saved', complete: false });
    this.#snapshot = {
      phase: 'needs-attention',
      exceptions: [],
      visit: this.#visit('needs-attention'),
      resourceEvidence: persisted?.evidence ?? this.#initialEvidence(),
      identityVerified: true,
      providerMode: this.#providerMode(),
    };
    return this.snapshot();
  }

  async submitIdentity(input: DemoIdentity): Promise<DemoWorkflowSnapshot> {
    await Promise.resolve();
    const identity = decideDemoIdentity({ kind: 'identity-submission', ...input }, []);
    if (identity.outcome === 'uncertain') return this.#identityRejectionSnapshot();
    if (this.#snapshot.phase !== 'empty') return this.snapshot();
    this.#identityVerified = true;
    this.#verifiedIdentity = structuredClone(input);
    this.#snapshot = { ...this.#snapshot, identityVerified: true, providerMode: this.#providerMode() };
    return this.snapshot();
  }

  async submitUncertainIdentityReplay(): Promise<DemoWorkflowSnapshot> {
    if (this.#snapshot.phase !== 'empty') return this.snapshot();
    const identity = decideDemoIdentity({
      kind: 'identity-submission',
      givenName: DEMO_V1.patient.givenName,
      familyName: DEMO_V1.patient.familyName,
      birthDate: '1974-02-15',
      postalCode: DEMO_V1.patient.postalCode,
    }, []);
    if (identity.outcome !== 'uncertain') throw new Error('Uncertain identity fixture did not stop');
    return this.#stopForIdentity(true);
  }

  async submitMemberId(memberId: string): Promise<DemoWorkflowSnapshot> {
    if (this.#snapshot.phase !== 'needs-attention') throw new Error('The visit is not waiting for a member ID');
    if (memberId !== DEMO_V1.memberId) throw new Error('The synthetic member ID was not accepted');
    let persisted: DemoPersistenceSnapshot | undefined;
    try {
      persisted = this.persistence
        ? await this.persistence.complete(memberId)
        : undefined;
    } catch {
      const decision = createStopOutcome('provider-failure', this.#domain.workflowRunId);
      if (!this.#snapshot.exceptions.some((item) => item.id === decision.exceptionCommand.commandId)) {
        this.#snapshot = {
          ...this.#snapshot,
          exceptions: [...this.#snapshot.exceptions, {
            id: decision.exceptionCommand.commandId,
            category: decision.category,
            status: 'requested',
            ownerReference: DEMO_V1.practitionerRoleReference,
          }],
        };
      }
      throw new ProviderCompletionError();
    }
    if (persisted && persisted.phase !== 'ready') throw new Error('Persistence did not commit a ready workflow');
    if (persisted) requirePersistedReadyEvidence(persisted.evidence);
    if (!this.persistence) await this.eligibility.check({ memberId });
    this.#domain = reduceWorkflow(this.#domain, { type: 'member-id-supplied' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'coverage-updated' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'eligibility-started' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'eligibility-persisted', linked: true, sourceIdentifierValid: true, outcomeAccepted: true });
    this.#domain = reduceWorkflow(this.#domain, { type: 'intake-completed' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'required-task-completed' });
    this.#snapshot = {
      phase: 'ready',
      exceptions: [],
      identityVerified: true,
      providerMode: this.#providerMode(),
      visit: this.#visit('ready'),
      resourceEvidence: persisted?.evidence ?? [
        ...this.#initialEvidence(),
        this.#evidence('CoverageEligibilityRequest', 'eligibility-request', 'Eligibility input'),
        this.#evidence('CoverageEligibilityResponse', 'eligibility-response', 'Eligibility evidence'),
        this.#evidence('Communication', 'member-follow-up-completed', 'Follow-up history'),
        this.#evidence('Provenance', 'ready-lineage', 'Version lineage'),
      ],
    };
    return this.snapshot();
  }

  async acknowledgeException(exceptionId: string): Promise<DemoWorkflowSnapshot> {
    const exception = this.#snapshot.exceptions.find((item) => item.id === exceptionId);
    if (!exception) throw new Error('Exception was not found');
    if (exception.status === 'accepted') return this.snapshot();
    const persisted = this.#snapshot.phase === 'stopped' && this.#snapshot.resourceEvidence.some((item) => item.resourceType === 'Task')
      ? await this.persistence?.acknowledgeException()
      : undefined;
    this.#snapshot = {
      ...this.#snapshot,
      resourceEvidence: persisted?.evidence ?? this.#snapshot.resourceEvidence,
      exceptions: this.#snapshot.exceptions.map((item) => item.id === exceptionId ? { ...item, status: 'accepted' } : item),
    };
    return this.snapshot();
  }

  #visit(status: 'needs-attention' | 'ready'): ReadyVisitVM {
    return {
      appointmentBusinessId: 'demo-v1:appointment:maria-wellness',
      patientDisplay: 'Maria Lopez',
      physicianDisplay: DEMO_V1.physician.display,
      startsAt: DEMO_V1.selectedSlot,
      status,
      openRequiredTaskCount: status === 'ready' ? 0 : 1,
      eligibilityTransaction: status === 'ready' ? 'completed' : 'not-run',
      sourceUpdatedAt: DEMO_V1.clock,
      provenanceState: status === 'ready' ? 'confirmed' : 'reconciling',
    };
  }

  async #stopForIdentity(persist: boolean): Promise<DemoWorkflowSnapshot> {
    let persisted: DemoPersistenceSnapshot | undefined;
    if (persist) {
      try {
        persisted = await this.persistence?.recordUncertainIdentity('demo-v1:exception:identity:uncertain');
      } catch {
        // Identity remains unbound and stopped even when the record provider is unavailable.
      }
    }
    this.#domain = reduceWorkflow(this.#domain, { type: 'stopped', category: 'identity' });
    this.#snapshot = {
      phase: 'stopped',
      stopCopy: 'VibeDoc could not verify this synthetic identity. No patient information was disclosed.',
      resourceEvidence: persisted?.evidence ?? [],
      exceptions: [{
        id: 'demo-v1:exception:identity:uncertain',
        category: 'identity',
        status: 'requested',
        ownerReference: DEMO_V1.practitionerRoleReference,
      }],
      identityVerified: false,
      providerMode: this.#providerMode(),
    };
    return this.snapshot();
  }

  #identityRejectionSnapshot(): DemoWorkflowSnapshot {
    return {
      phase: 'stopped',
      stopCopy: 'VibeDoc could not verify this synthetic identity. No patient information was disclosed.',
      resourceEvidence: [],
      exceptions: [{
        id: 'demo-v1:exception:identity:uncertain',
        category: 'identity',
        status: 'requested',
        ownerReference: DEMO_V1.practitionerRoleReference,
      }],
      identityVerified: false,
      providerMode: this.#providerMode(),
    };
  }

  async #stopForProviderFailure(): Promise<DemoWorkflowSnapshot> {
    const decision = createStopOutcome('provider-failure', this.#domain.workflowRunId);
    let persisted: DemoPersistenceSnapshot | undefined;
    try {
      persisted = await this.persistence?.recordException(
        decision.category,
        decision.exceptionCommand.commandId,
      );
    } catch {
      // The provider that failed the workflow may also be unable to persist its exception.
      // Keep the safe, owned in-memory stop visible without leaking provider details.
    }
    this.#domain = reduceWorkflow(this.#domain, { type: 'stopped', category: decision.category });
    this.#snapshot = {
      phase: 'stopped',
      stopCopy: PROVIDER_FAILURE_COPY,
      resourceEvidence: persisted?.evidence ?? [],
      exceptions: [{
        id: decision.exceptionCommand.commandId,
        category: decision.category,
        status: 'requested',
        ownerReference: DEMO_V1.practitionerRoleReference,
      }],
      identityVerified: this.#identityVerified,
      providerMode: this.#providerMode(),
    };
    return this.snapshot();
  }

  #initialEvidence(): DemoResourceEvidence[] {
    return [
      this.#evidence('Patient', 'patient:maria', 'Identity'),
      this.#evidence('Appointment', 'appointment:maria-wellness', 'Scheduling'),
      this.#evidence('Coverage', 'coverage:maria', 'Coverage'),
      this.#evidence('QuestionnaireResponse', 'intake:maria', 'Patient-reported intake'),
      this.#evidence('Task', 'task:missing-member-id', 'Owned exception'),
    ];
  }

  #evidence(resourceType: string, id: string, workflowRole: string): DemoResourceEvidence {
    return {
      resourceType,
      reference: `${resourceType}/${DEMO_V1.identifierPrefix}${id}`,
      version: '1',
      sourceUpdatedAt: DEMO_V1.clock,
      workflowRole,
    };
  }

  #providerMode(): 'fixture' | 'live' {
    return this.persistence ? 'live' : 'fixture';
  }
}
