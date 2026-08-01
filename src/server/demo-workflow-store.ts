import type { ReadyVisitVM } from '../contracts/ready-visit.js';
import { ScriptedConversationAdapter } from '../adapters/scripted-conversation.js';
import { StediEligibilityFixture } from '../adapters/stedi-eligibility-fixture.js';
import { createWorkflowState, reduceWorkflow, type DemoWorkflowState } from '../domain/workflow-reducer.js';
import { DEMO_V1 } from '../test/fixtures/demo-v1.js';

export type DemoResourceEvidence = {
  resourceType: string;
  reference: string;
  version: string;
  sourceUpdatedAt: string;
  workflowRole: string;
};

export type DemoException = {
  id: string;
  category: 'clinical-language' | 'identity';
  status: 'requested';
  ownerReference: string;
};

export type DemoWorkflowSnapshot = {
  phase: 'empty' | 'needs-attention' | 'ready' | 'stopped';
  visit?: ReadyVisitVM;
  exceptions: DemoException[];
  resourceEvidence: DemoResourceEvidence[];
};

export class DemoWorkflowStore {
  #domain: DemoWorkflowState = createWorkflowState('demo-v1:workflow:maria');
  #snapshot: DemoWorkflowSnapshot = { phase: 'empty', exceptions: [], resourceEvidence: [] };

  constructor(
    private readonly conversation = new ScriptedConversationAdapter(),
    private readonly eligibility = new StediEligibilityFixture(),
  ) {}

  snapshot(): DemoWorkflowSnapshot {
    return structuredClone(this.#snapshot);
  }

  reset(): DemoWorkflowSnapshot {
    this.#domain = createWorkflowState('demo-v1:workflow:maria');
    this.#snapshot = { phase: 'empty', exceptions: [], resourceEvidence: [] };
    return this.snapshot();
  }

  async submitRequest(message: string): Promise<DemoWorkflowSnapshot> {
    if (this.#snapshot.phase === 'stopped') return this.snapshot();
    try {
      await this.conversation.interpret(message);
    } catch {
      this.#domain = reduceWorkflow(this.#domain, { type: 'stopped', category: 'clinical-language' });
      this.#snapshot = {
        phase: 'stopped',
        resourceEvidence: [],
        exceptions: [{
          id: 'demo-v1:exception:clinical-language',
          category: 'clinical-language',
          status: 'requested',
          ownerReference: DEMO_V1.practitionerRoleReference,
        }],
      };
      return this.snapshot();
    }

    if (this.#snapshot.phase !== 'empty') return this.snapshot();
    this.#domain = reduceWorkflow(this.#domain, { type: 'identity-verified' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'appointment-booked' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'intake-saved', complete: false });
    this.#snapshot = {
      phase: 'needs-attention',
      exceptions: [],
      visit: this.#visit('needs-attention'),
      resourceEvidence: this.#initialEvidence(),
    };
    return this.snapshot();
  }

  async submitMemberId(memberId: string): Promise<DemoWorkflowSnapshot> {
    if (this.#snapshot.phase !== 'needs-attention') throw new Error('The visit is not waiting for a member ID');
    await this.eligibility.check({ memberId });
    this.#domain = reduceWorkflow(this.#domain, { type: 'member-id-supplied' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'coverage-updated' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'eligibility-started' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'eligibility-persisted', linked: true, sourceIdentifierValid: true, outcomeAccepted: true });
    this.#domain = reduceWorkflow(this.#domain, { type: 'intake-completed' });
    this.#domain = reduceWorkflow(this.#domain, { type: 'required-task-completed' });
    this.#snapshot = {
      phase: 'ready',
      exceptions: [],
      visit: this.#visit('ready'),
      resourceEvidence: [
        ...this.#initialEvidence(),
        this.#evidence('CoverageEligibilityRequest', 'eligibility-request', 'Eligibility input'),
        this.#evidence('CoverageEligibilityResponse', 'eligibility-response', 'Eligibility evidence'),
        this.#evidence('Communication', 'member-follow-up-completed', 'Follow-up history'),
        this.#evidence('Provenance', 'ready-lineage', 'Version lineage'),
      ],
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
}
