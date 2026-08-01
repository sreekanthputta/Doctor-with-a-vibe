import type { Identifier, Resource } from '@medplum/fhirtypes';
import { describe, expect, it } from 'vitest';
import { MedplumDemoPersistence } from '../../src/adapters/medplum-demo-persistence';
import type { FhirRepository, MutationPlan } from '../../src/fhir/repository';
import { DEMO_V1 } from '../../src/test/fixtures/demo-v1';

class MemoryRepository implements FhirRepository {
  readonly events: string[] = [];
  readonly resources = new Map<string, Resource>();
  readonly failOn = new Set<string>();
  #nextId = 1;

  async conditionalCreate<T extends Resource>(resource: T): Promise<{ created: boolean; resource: T }> {
    const identifier = identifiersOf(resource)[0];
    const existing = [...this.resources.values()].find((candidate) =>
      candidate.resourceType === resource.resourceType
      && identifiersOf(candidate).some((value) => value.system === identifier?.system && value.value === identifier?.value));
    if (existing) return { created: false, resource: structuredClone(existing) as T };
    return { created: true, resource: await this.persist(resource, 'conditional-create') };
  }

  create<T extends Resource>(plan: MutationPlan<T>): Promise<T> {
    return this.persist(plan.resource, 'create');
  }

  update<T extends Resource>(plan: MutationPlan<T>): Promise<T> {
    const key = `${plan.resource.resourceType}/${plan.resource.id}`;
    const current = this.resources.get(key);
    if (!current || current.meta?.versionId !== plan.expectedVersion) throw new Error('version conflict');
    const status = statusOf(plan.resource);
    this.events.push(`update:${plan.resource.resourceType}:${status}`);
    if (this.failOn.has(`update:${plan.resource.resourceType}:${status}`)) {
      return Promise.reject(new Error(`forced ${plan.resource.resourceType} update failure`));
    }
    const persisted = { ...structuredClone(plan.resource), meta: { versionId: String(Number(plan.expectedVersion) + 1), lastUpdated: DEMO_V1.clock } } as T;
    this.resources.set(key, persisted);
    return Promise.resolve(structuredClone(persisted));
  }

  read<T extends Resource>(reference: string): Promise<T | undefined> {
    this.events.push(`read:${reference.split('/')[0]}`);
    return Promise.resolve(structuredClone(this.resources.get(reference)) as T | undefined);
  }

  searchByIdentifier<T extends Resource>(resourceType: T['resourceType'], identifier: Identifier): Promise<T[]> {
    return Promise.resolve([...this.resources.values()].filter((resource) =>
      resource.resourceType === resourceType
      && identifiersOf(resource).some((value) => value.system === identifier.system && value.value === identifier.value)) as T[]);
  }

  delete = (reference: string): Promise<void> => {
    this.events.push(`delete:${reference.split('/')[0]}`);
    this.resources.delete(reference);
    return Promise.resolve();
  };

  private persist<T extends Resource>(resource: T, operation: string): Promise<T> {
    this.events.push(`${operation}:${resource.resourceType}`);
    if (this.failOn.has(`${operation}:${resource.resourceType}`)) return Promise.reject(new Error(`forced ${resource.resourceType} failure`));
    const id = resource.id ?? `${resource.resourceType.toLowerCase()}-${this.#nextId++}`;
    const persisted = { ...structuredClone(resource), id, meta: { versionId: '1', lastUpdated: DEMO_V1.clock } } as T;
    this.resources.set(`${resource.resourceType}/${id}`, persisted);
    return Promise.resolve(structuredClone(persisted));
  }
}

function identifiersOf(resource: Resource): Identifier[] {
  return 'identifier' in resource && Array.isArray(resource.identifier) ? resource.identifier : [];
}

function statusOf(resource: Resource): string {
  return 'status' in resource && typeof resource.status === 'string' ? resource.status : '';
}

const exactIdentity = {
  givenName: DEMO_V1.patient.givenName,
  familyName: DEMO_V1.patient.familyName,
  birthDate: DEMO_V1.patient.birthDate,
  postalCode: DEMO_V1.patient.postalCode,
};

function createHarness(repository = new MemoryRepository()) {
  return {
    repository,
    persistence: new MedplumDemoPersistence({
      repository,
      deleteResource: repository.delete,
      runId: 'integration-run',
      now: () => DEMO_V1.clock,
    }),
  };
}

describe('MedplumDemoPersistence', () => {
  it('persists and rereads the minimal needs-attention graph in dependency order', async () => {
    const { persistence, repository } = createHarness();
    const result = await persistence.start(exactIdentity);

    expect(result.phase).toBe('needs-attention');
    expect(result.evidence.map((item) => item.resourceType)).toEqual([
      'Patient', 'Appointment', 'Coverage', 'QuestionnaireResponse', 'Task', 'CommunicationRequest', 'Communication',
    ]);
    expect(result.evidence.every((item) => item.reference.includes('/') && item.version === '1')).toBe(true);
    expect(repository.events).toEqual(expect.arrayContaining([
      'conditional-create:Patient', 'create:Appointment', 'create:Coverage', 'create:QuestionnaireResponse',
      'create:Task', 'create:CommunicationRequest', 'create:Communication',
    ]));
    for (const evidence of result.evidence) expect(repository.events).toContain(`read:${evidence.resourceType}`);
  });

  it('updates versioned intake and coverage, persists linked eligibility, then completes the same Task', async () => {
    const { persistence, repository } = createHarness();
    const started = await persistence.start(exactIdentity);
    const taskReference = started.evidence.find((item) => item.resourceType === 'Task')?.reference;

    const completed = await persistence.complete(DEMO_V1.memberId);
    const eligibilityRequest = [...repository.resources.values()].find((item) => item.resourceType === 'CoverageEligibilityRequest');
    const eligibilityResponse = [...repository.resources.values()].find((item) => item.resourceType === 'CoverageEligibilityResponse');
    const task = repository.resources.get(taskReference ?? '');

    expect(completed.phase).toBe('ready');
    expect(task?.resourceType === 'Task' && task.status).toBe('completed');
    expect(eligibilityResponse?.resourceType === 'CoverageEligibilityResponse' && eligibilityResponse.request?.reference)
      .toBe(`CoverageEligibilityRequest/${eligibilityRequest?.id}`);
    expect(completed.evidence.some((item) => item.resourceType === 'Provenance')).toBe(true);
    const responseCreate = repository.events.indexOf('create:CoverageEligibilityResponse');
    const taskComplete = repository.events.indexOf('update:Task:completed');
    expect(responseCreate).toBeGreaterThan(-1);
    expect(taskComplete).toBeGreaterThan(responseCreate);
  });

  it('does not complete the Task when eligibility persistence fails', async () => {
    const { persistence, repository } = createHarness();
    await persistence.start(exactIdentity);
    repository.failOn.add('create:CoverageEligibilityResponse');

    await expect(persistence.complete(DEMO_V1.memberId)).rejects.toThrow('CoverageEligibilityResponse');
    const task = [...repository.resources.values()].find((item) => item.resourceType === 'Task');
    expect(task?.resourceType === 'Task' && task.status).toBe('requested');
    expect(repository.events).not.toContain('update:Task:completed');
  });

  it('creates exactly one unbound owned requested Task for uncertain identity', async () => {
    const { persistence, repository } = createHarness();
    const first = await persistence.recordUncertainIdentity('uncertain-1');
    const second = await persistence.recordUncertainIdentity('uncertain-1');
    const tasks = [...repository.resources.values()].filter((resource) => resource.resourceType === 'Task');

    expect(first).toEqual(second);
    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.resourceType === 'Task' && task.status).toBe('requested');
    expect(task?.resourceType === 'Task' && task.owner?.reference).toBe(DEMO_V1.practitionerRoleReference);
    expect(task?.resourceType === 'Task' && task.for).toBeUndefined();
    expect(task?.resourceType === 'Task' && task.focus).toBeUndefined();
  });

  it('resets only instance-recorded resources in reverse order and verifies deletion', async () => {
    const { persistence, repository } = createHarness();
    await persistence.start(exactIdentity);
    await persistence.complete(DEMO_V1.memberId);
    const createdOrder = [...repository.resources.keys()];

    const reset = await persistence.reset();
    const deleted = repository.events.filter((event) => event.startsWith('delete:')).map((event) => event.slice(7));
    expect(reset).toEqual({ deletedCount: createdOrder.length, verified: true });
    expect(deleted).toEqual(createdOrder.reverse().map((reference) => reference.split('/')[0]));
    expect(repository.resources.size).toBe(0);
  });
});
