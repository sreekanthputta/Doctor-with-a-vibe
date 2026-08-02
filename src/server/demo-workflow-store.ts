import type { ReadyVisitVM } from '../contracts/ready-visit.js';
import { ScriptedConversationAdapter } from '../adapters/scripted-conversation.js';
import { StediEligibilityFixture } from '../adapters/stedi-eligibility-fixture.js';
import { createWorkflowState, reduceWorkflow, type DemoWorkflowState } from '../domain/workflow-reducer.js';
import { DEMO_V1 } from '../test/fixtures/demo-v1.js';
import type { StopCategory } from '../domain/exception-policy.js';
import { decideDemoIdentity } from '../domain/identity-gate.js';
import type { DemoIdentity, DemoPersistence } from './demo-persistence.js';

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
    const persisted = await this.persistence?.start(this.#verifiedIdentity);
    if (persisted && persisted.phase !== 'needs-attention') throw new Error('Persistence did not commit a needs-attention workflow');
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
    if (this.#snapshot.phase !== 'empty') return this.snapshot();
    const identity = decideDemoIdentity({ kind: 'identity-submission', ...input }, []);
    if (identity.outcome === 'uncertain') return this.#stopForIdentity(true);
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
    const persisted = this.persistence
      ? await this.persistence.complete(memberId)
      : undefined;
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
    const persisted = await this.persistence?.acknowledgeException();
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
    const persisted = persist
      ? await this.persistence?.recordUncertainIdentity('demo-v1:exception:identity:uncertain')
      : undefined;
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
