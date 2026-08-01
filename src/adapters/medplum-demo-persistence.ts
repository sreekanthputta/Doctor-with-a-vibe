import type {
  Coverage,
  QuestionnaireResponse,
  Resource,
  Task,
} from '@medplum/fhirtypes';
import type { MedplumClient } from '@medplum/core';
import { StediEligibilityFixture } from './stedi-eligibility-fixture';
import { MedplumFhirRepository } from './medplum-fhir-repository';
import { buildDeliveredInAppCommunication, buildFollowUpRequest } from '../fhir/communication';
import { buildCoverage, planCoverageMemberIdUpdate } from '../fhir/coverage';
import { buildEligibilityRequest, buildEligibilityResponse } from '../fhir/eligibility';
import { requireVersionedReference } from '../fhir/identifiers';
import { buildDemoPatientCreate } from '../fhir/patient';
import { buildVersionedProvenance } from '../fhir/provenance';
import { buildQuestionnaireResponse, planQuestionnaireResponseCompletion } from '../fhir/questionnaire';
import { buildMutationPlan, type FhirRepository } from '../fhir/repository';
import { buildAppointmentDraft } from '../fhir/scheduling';
import { buildMissingMemberTask, buildUncertainIdentityTask } from '../fhir/tasks';
import type {
  DemoIdentity,
  DemoPersistence,
  DemoPersistenceSnapshot,
  PersistedResourceEvidence,
} from '../server/demo-persistence';
import { DEMO_V1 } from '../test/fixtures/demo-v1';

type EligibilityPort = Pick<StediEligibilityFixture, 'check'>;
type DeleteResource = (reference: string) => Promise<void>;

type DemoSeedReferences = {
  healthcareServiceReference: string;
  slotReference: string;
  insurerReference: string;
  providerReference: string;
};

const DEFAULT_SEED_REFERENCES: DemoSeedReferences = {
  healthcareServiceReference: 'HealthcareService/adult-primary-care',
  slotReference: 'Slot/slot-2',
  insurerReference: 'Organization/aetna-demo',
  providerReference: DEMO_V1.practitionerRoleReference,
};

type PersistedGraph = {
  patient: Resource;
  appointment: Resource;
  coverage: Coverage;
  questionnaireResponse: QuestionnaireResponse;
  task: Task;
  communicationRequest: Resource;
  communication: Resource;
};

const WORKFLOW_ROLES: Record<string, string> = {
  Patient: 'Identity',
  Appointment: 'Scheduling',
  Coverage: 'Coverage',
  QuestionnaireResponse: 'Patient-reported intake',
  Task: 'Owned exception',
  CommunicationRequest: 'Follow-up request',
  Communication: 'Delivered follow-up',
  CoverageEligibilityRequest: 'Eligibility input',
  CoverageEligibilityResponse: 'Eligibility evidence',
  Provenance: 'Version lineage',
};

function referenceOf(resource: Resource): string {
  if (!resource.id) throw new Error(`${resource.resourceType} persistence returned no id`);
  return `${resource.resourceType}/${resource.id}`;
}

function validateIdentity(identity: DemoIdentity): void {
  if (
    identity.givenName !== DEMO_V1.patient.givenName
    || identity.familyName !== DEMO_V1.patient.familyName
    || identity.birthDate !== DEMO_V1.patient.birthDate
    || identity.postalCode !== DEMO_V1.patient.postalCode
  ) {
    throw new Error('Only the exact verified synthetic identity may start persistence');
  }
}

export class MedplumDemoPersistence implements DemoPersistence {
  readonly #repository: FhirRepository;
  readonly #deleteResource: DeleteResource;
  readonly #eligibility: EligibilityPort;
  readonly #runId: string;
  readonly #now: () => string;
  readonly #seedReferences: DemoSeedReferences;
  readonly #createdReferences: string[] = [];
  #graph?: PersistedGraph;
  #snapshot?: DemoPersistenceSnapshot;
  #uncertainSnapshot?: DemoPersistenceSnapshot;

  constructor(input: {
    repository: FhirRepository;
    deleteResource: DeleteResource;
    runId: string;
    eligibility?: EligibilityPort;
    now?: () => string;
    seedReferences?: DemoSeedReferences;
  }) {
    if (!/^[A-Za-z0-9.-]+$/.test(input.runId)) throw new Error('Persistence requires a safe run ID');
    this.#repository = input.repository;
    this.#deleteResource = input.deleteResource;
    this.#runId = input.runId;
    this.#eligibility = input.eligibility ?? new StediEligibilityFixture();
    this.#now = input.now ?? (() => new Date().toISOString());
    this.#seedReferences = input.seedReferences ?? DEFAULT_SEED_REFERENCES;
  }

  static fromClient(client: MedplumClient, input: {
    runId: string;
    eligibility?: EligibilityPort;
    now?: () => string;
    seedReferences?: DemoSeedReferences;
  }): MedplumDemoPersistence {
    return new MedplumDemoPersistence({
      repository: new MedplumFhirRepository(client),
      deleteResource: async (reference) => {
        const [resourceType, id, extra] = reference.split('/');
        if (!resourceType || !id || extra) throw new Error('Reset requires an exact ResourceType/id reference');
        await client.deleteResource(resourceType as never, id);
      },
      ...input,
    });
  }

  async start(identity: DemoIdentity): Promise<DemoPersistenceSnapshot> {
    validateIdentity(identity);
    if (this.#snapshot) return structuredClone(this.#snapshot);
    if (this.#uncertainSnapshot) throw new Error('An uncertain-identity session cannot bind a patient');

    const patientCreate = buildDemoPatientCreate();
    const patientResult = await this.#repository.conditionalCreate(patientCreate.resource, patientCreate.ifNoneExist);
    const patient = await this.#reread(patientResult.resource);
    if (patientResult.created) this.#record(patient);
    const patientReference = referenceOf(patient);

    const appointment = await this.#create({
      ...buildAppointmentDraft({
        appointmentBusinessId: `${this.#runId}-maria-wellness`,
        patientReference,
        healthcareServiceReference: this.#seedReferences.healthcareServiceReference,
        slotReference: this.#seedReferences.slotReference,
        startsAt: DEMO_V1.selectedSlot,
        endsAt: '2026-08-04T16:00:00.000Z',
      }),
      status: 'booked',
    }, 'appointment');
    const appointmentReference = referenceOf(appointment);

    const coverage = await this.#create(buildCoverage({
      patientReference,
      payerDisplay: 'Aetna (synthetic demo)',
      coverageBusinessId: `${this.#runId}-maria-aetna`,
    }), 'coverage');
    const coverageReference = referenceOf(coverage);

    const questionnaireResponse = await this.#create(buildQuestionnaireResponse({
      patientReference,
      authoredAt: this.#now(),
      responseBusinessId: `${this.#runId}-maria-wellness`,
      answers: {
        'contact-email': 'maria.lopez@example.test',
        'contact-phone': '+13125550100',
        'coverage-payer-name': 'Aetna',
        'administrative-communication-consent': true,
      },
    }), 'questionnaire-response');
    const questionnaireResponseReference = referenceOf(questionnaireResponse);

    const task = await this.#create(buildMissingMemberTask({
      taskBusinessId: `${this.#runId}-collect-member-id`,
      patientReference,
      questionnaireResponseReference,
      appointmentReference,
      coverageReference,
      dueStart: this.#now(),
      dueEnd: '2026-08-01T19:00:00-05:00',
    }), 'missing-member-task');
    const taskReference = referenceOf(task);

    const communicationRequest = await this.#create(buildFollowUpRequest({
      businessId: `${this.#runId}-member-id-follow-up`,
      patientReference,
      taskReference,
      authoredAt: this.#now(),
    }), 'follow-up-request');
    const communication = await this.#create(buildDeliveredInAppCommunication({
      businessId: `${this.#runId}-member-id-follow-up-delivered`,
      patientReference,
      taskReference,
      sentAt: this.#now(),
    }), 'follow-up-delivery');

    this.#graph = { patient, appointment, coverage, questionnaireResponse, task, communicationRequest, communication };
    this.#snapshot = {
      phase: 'needs-attention',
      evidence: await this.#evidence(Object.values(this.#graph)),
    };
    return structuredClone(this.#snapshot);
  }

  async complete(memberId: string): Promise<DemoPersistenceSnapshot> {
    if (!this.#graph || !this.#snapshot) throw new Error('The persisted workflow has not started');
    if (this.#snapshot.phase === 'ready') return structuredClone(this.#snapshot);
    const eligibilityResult = await this.#eligibility.check({ memberId });

    const coveragePlan = planCoverageMemberIdUpdate({ coverage: this.#graph.coverage, memberId });
    const coverage = await this.#update(coveragePlan.resource, coveragePlan.expectedVersion, 'coverage-member-id');

    const questionnaireWithMember: QuestionnaireResponse = {
      ...this.#graph.questionnaireResponse,
      item: [
        ...(this.#graph.questionnaireResponse.item ?? []),
        { linkId: 'coverage-member-id', answer: [{ valueString: memberId }] },
      ],
    };
    const questionnairePlan = planQuestionnaireResponseCompletion(questionnaireWithMember);
    const questionnaireResponse = await this.#update(
      questionnairePlan.resource,
      questionnairePlan.expectedVersion,
      'complete-intake',
    );

    const eligibilityRequest = await this.#create(buildEligibilityRequest({
      requestBusinessId: `${this.#runId}-maria-wellness`,
      responseBusinessId: `${this.#runId}-maria-wellness`,
      patientReference: referenceOf(this.#graph.patient),
      coverageReference: referenceOf(coverage),
      insurerReference: this.#seedReferences.insurerReference,
      providerReference: this.#seedReferences.providerReference,
      createdAt: this.#now(),
      memberId,
    }), 'eligibility-request');
    const eligibilityResponse = await this.#create(buildEligibilityResponse({
      responseBusinessId: `${this.#runId}-maria-wellness`,
      createdAt: this.#now(),
      request: eligibilityRequest,
      result: eligibilityResult,
    }), 'eligibility-response');

    const inProgressTask = await this.#update({ ...this.#graph.task, status: 'in-progress' }, requireVersionedReference(this.#graph.task).versionId, 'task-in-progress');
    const completedTask = await this.#update({ ...inProgressTask, status: 'completed' }, requireVersionedReference(inProgressTask).versionId, 'task-complete');

    const committed = [coverage, questionnaireResponse, eligibilityRequest, eligibilityResponse, completedTask];
    const provenances: Resource[] = [];
    for (const target of committed) {
      const versioned = requireVersionedReference(target);
      provenances.push(await this.#create(buildVersionedProvenance({
        provenanceBusinessId: `${this.#runId}-${target.resourceType.toLowerCase()}`,
        targetReference: versioned.reference,
        targetVersionId: versioned.versionId,
        recordedAt: this.#now(),
        agentReference: DEMO_V1.practitionerRoleReference,
      }), `provenance-${target.resourceType.toLowerCase()}`));
    }

    this.#graph = { ...this.#graph, coverage, questionnaireResponse, task: completedTask };
    this.#snapshot = {
      phase: 'ready',
      evidence: await this.#evidence([
        this.#graph.patient,
        this.#graph.appointment,
        coverage,
        questionnaireResponse,
        completedTask,
        this.#graph.communicationRequest,
        this.#graph.communication,
        eligibilityRequest,
        eligibilityResponse,
        ...provenances,
      ]),
    };
    return structuredClone(this.#snapshot);
  }

  async recordUncertainIdentity(correlationId: string): Promise<DemoPersistenceSnapshot> {
    if (this.#snapshot) throw new Error('A patient-bound workflow cannot become an uncertain-identity session');
    if (this.#uncertainSnapshot) return structuredClone(this.#uncertainSnapshot);
    const task = await this.#create(buildUncertainIdentityTask({
      taskBusinessId: `${this.#runId}-uncertain-identity`,
      correlationId,
      dueStart: this.#now(),
      dueEnd: '2026-08-01T19:00:00-05:00',
    }), 'uncertain-identity');
    this.#uncertainSnapshot = { phase: 'stopped', evidence: await this.#evidence([task]) };
    return structuredClone(this.#uncertainSnapshot);
  }

  async reset(): Promise<{ deletedCount: number; verified: true }> {
    const references = [...this.#createdReferences].reverse();
    for (const reference of references) await this.#deleteResource(reference);
    for (const reference of references) {
      try {
        if (await this.#repository.read(reference)) throw new Error(`Reset could not verify deletion of ${reference}`);
      } catch (error) {
        if (!(error instanceof Error) || !/gone|410/i.test(error.message)) throw error;
      }
    }
    this.#createdReferences.length = 0;
    this.#graph = undefined;
    this.#snapshot = undefined;
    this.#uncertainSnapshot = undefined;
    return { deletedCount: references.length, verified: true };
  }

  async #create<T extends Resource>(resource: T, key: string): Promise<T> {
    const created = await this.#repository.create(buildMutationPlan({
      workflow: 'ready-visit',
      operation: 'create',
      resource,
      idempotencyKey: `demo-v1:${this.#runId}:${key}`,
    }));
    const reread = await this.#reread(created);
    this.#record(reread);
    return reread;
  }

  async #update<T extends Resource>(resource: T, expectedVersion: string, key: string): Promise<T> {
    const updated = await this.#repository.update(buildMutationPlan({
      workflow: 'ready-visit',
      operation: 'update',
      resource,
      expectedVersion,
      idempotencyKey: `demo-v1:${this.#runId}:${key}`,
    }));
    return this.#reread(updated);
  }

  async #reread<T extends Resource>(resource: T): Promise<T> {
    const reread = await this.#repository.read<T>(referenceOf(resource));
    if (!reread?.meta?.versionId) throw new Error(`${resource.resourceType} did not reread with a committed version`);
    return reread;
  }

  #record(resource: Resource): void {
    const reference = referenceOf(resource);
    if (!this.#createdReferences.includes(reference)) this.#createdReferences.push(reference);
  }

  async #evidence(resources: Resource[]): Promise<PersistedResourceEvidence[]> {
    return Promise.all(resources.map(async (resource) => {
      const reread = await this.#reread(resource);
      const reference = requireVersionedReference(reread);
      return {
        resourceType: reread.resourceType,
        reference: reference.reference,
        version: reference.versionId,
        sourceUpdatedAt: reread.meta?.lastUpdated ?? this.#now(),
        workflowRole: WORKFLOW_ROLES[reread.resourceType] ?? 'Workflow evidence',
      };
    }));
  }
}
