import type { Identifier, Resource } from '@medplum/fhirtypes';
import { describe, expect, it } from 'vitest';
import { MedplumDemoPersistence } from '../../src/adapters/medplum-demo-persistence';
import { StediEligibilityFixture } from '../../src/adapters/stedi-eligibility-fixture';
import type { FhirRepository, MutationPlan } from '../../src/fhir/repository';
import { DEMO_V1 } from '../../src/test/fixtures/demo-v1';

class MemoryRepository implements FhirRepository {
  readonly events: string[] = [];
  readonly resources = new Map<string, Resource>();
  readonly failOn = new Set<string>();
  duplicatePatientOnSearch = false;
  corruptEligibilityResponseOnRead = false;
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
    const resource = structuredClone(this.resources.get(reference));
    if (this.corruptEligibilityResponseOnRead && resource?.resourceType === 'CoverageEligibilityResponse') {
      resource.request = { reference: 'CoverageEligibilityRequest/wrong-request' };
    }
    return Promise.resolve(resource as T | undefined);
  }

  searchByIdentifier<T extends Resource>(resourceType: T['resourceType'], identifier: Identifier): Promise<T[]> {
    const found = [...this.resources.values()].filter((resource) =>
      resource.resourceType === resourceType
      && identifiersOf(resource).some((value) => value.system === identifier.system && value.value === identifier.value)) as T[];
    if (this.duplicatePatientOnSearch && resourceType === 'Patient' && found[0]) {
      found.push({ ...structuredClone(found[0]), id: 'forged-duplicate' });
    }
    return Promise.resolve(found);
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
  it('derives each exception deadline from the current clock and the four-hour policy', async () => {
    const { persistence, repository } = createHarness();
    await persistence.start(exactIdentity);
    const task = [...repository.resources.values()].find((item) => item.resourceType === 'Task');

    expect(task?.resourceType === 'Task' && task.restriction?.period).toEqual({
      start: DEMO_V1.clock,
      end: '2026-08-02T00:00:00.000Z',
    });
  });

  it('fails closed when the post-conditional-create identity search is not unique', async () => {
    const { persistence, repository } = createHarness();
    repository.duplicatePatientOnSearch = true;

    await expect(persistence.start(exactIdentity)).rejects.toThrow('unique Patient');
    expect([...repository.resources.values()].some((item) => item.resourceType === 'Appointment')).toBe(false);
  });

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

  it('uses atomic scheduling evidence instead of directly creating a booked Appointment when configured', async () => {
    const repository = new MemoryRepository();
    const atomicScheduling = {
      book: (draft: import('@medplum/fhirtypes').Appointment) => {
        expect(draft.status).toBe('proposed');
        const appointment = {
          ...structuredClone(draft), id: 'atomic-appointment', meta: { versionId: '1', lastUpdated: DEMO_V1.clock },
          status: 'booked' as const, slot: [{ reference: 'Slot/atomic-busy' }],
        };
        const slot = {
          resourceType: 'Slot' as const, id: 'atomic-busy', meta: { versionId: '1', lastUpdated: DEMO_V1.clock },
          status: 'busy' as const, schedule: { reference: 'Schedule/live' }, start: draft.start!, end: draft.end!,
        };
        repository.resources.set('Appointment/atomic-appointment', appointment);
        repository.resources.set('Slot/atomic-busy', slot);
        return Promise.resolve({ appointment, slots: [slot] });
      },
    };
    const persistence = new MedplumDemoPersistence({
      repository, deleteResource: repository.delete, runId: 'atomic-run', atomicScheduling, now: () => DEMO_V1.clock,
    });

    await persistence.start(exactIdentity);

    expect(repository.events).not.toContain('create:Appointment');
    expect(repository.resources.get('Slot/atomic-busy')?.resourceType).toBe('Slot');
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

  it('commits and rereads Coverage before invoking eligibility', async () => {
    const repository = new MemoryRepository();
    const eligibility = {
      check: async ({ memberId }: { memberId: string }) => {
        const coverage = [...repository.resources.values()].find((item) => item.resourceType === 'Coverage');
        expect(coverage?.resourceType === 'Coverage' && coverage.subscriberId).toBe(memberId);
        return new StediEligibilityFixture().check({ memberId });
      },
    };
    const persistence = new MedplumDemoPersistence({
      repository,
      deleteResource: repository.delete,
      runId: 'coverage-first-run',
      eligibility,
      now: () => DEMO_V1.clock,
    });
    await persistence.start(exactIdentity);

    await expect(persistence.complete(DEMO_V1.memberId)).resolves.toMatchObject({ phase: 'ready' });
  });

  it('resumes after partial eligibility persistence without repeating committed updates', async () => {
    const { persistence, repository } = createHarness();
    await persistence.start(exactIdentity);
    repository.failOn.add('create:CoverageEligibilityResponse');
    await expect(persistence.complete(DEMO_V1.memberId)).rejects.toThrow('CoverageEligibilityResponse');
    repository.failOn.delete('create:CoverageEligibilityResponse');

    await expect(persistence.complete(DEMO_V1.memberId)).resolves.toMatchObject({ phase: 'ready' });
    expect([...repository.resources.values()].filter((item) => item.resourceType === 'CoverageEligibilityRequest')).toHaveLength(1);
  });

  it('does not project Ready from malformed reread eligibility evidence', async () => {
    const { persistence, repository } = createHarness();
    await persistence.start(exactIdentity);
    repository.corruptEligibilityResponseOnRead = true;

    await expect(persistence.complete(DEMO_V1.memberId)).rejects.toThrow('linked eligibility');
    const task = [...repository.resources.values()].find((item) => item.resourceType === 'Task');
    expect(task?.resourceType === 'Task' && task.status).toBe('requested');
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

  it('persists one unbound owned clinical-language exception without creating an Appointment', async () => {
    const { persistence, repository } = createHarness();
    const first = await persistence.recordException('clinical-language', 'clinical-stop-1');
    const second = await persistence.recordException('clinical-language', 'clinical-stop-1');
    const tasks = [...repository.resources.values()].filter((resource) => resource.resourceType === 'Task');

    expect(first).toEqual(second);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ resourceType: 'Task', status: 'requested', owner: { reference: DEMO_V1.practitionerRoleReference } });
    expect(tasks[0]?.resourceType === 'Task' && tasks[0].for).toBeUndefined();
    expect([...repository.resources.values()].some((resource) => resource.resourceType === 'Appointment')).toBe(false);
  });

  it('accepts the uncertain identity Task once using a version-aware human transition', async () => {
    const { persistence, repository } = createHarness();
    const stopped = await persistence.recordUncertainIdentity('uncertain-1');
    const taskEvidence = stopped.evidence.find((item) => item.resourceType === 'Task');

    const first = await persistence.acknowledgeException();
    const second = await persistence.acknowledgeException();
    const task = taskEvidence ? repository.resources.get(taskEvidence.reference) : undefined;

    expect(first).toEqual(second);
    expect(first.phase).toBe('stopped');
    expect(task?.resourceType === 'Task' && task.status).toBe('accepted');
    expect(task?.meta?.versionId).toBe('2');
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
