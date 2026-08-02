import type { Identifier, Resource } from '@medplum/fhirtypes';
import { describe, expect, it } from 'vitest';
import type { FhirRepository, MutationPlan } from '../../src/fhir/repository';
import { ensureLiveMedplumBaseline } from '../../src/server/live-medplum-baseline';

class BaselineRepository implements FhirRepository {
  readonly resources = new Map<string, Resource>();
  #next = 1;

  conditionalCreate<T extends Resource>(resource: T): Promise<{ created: boolean; resource: T }> {
    const identifier = identifiers(resource)[0];
    const existing = [...this.resources.values()].find((candidate) => candidate.resourceType === resource.resourceType
      && identifiers(candidate).some((value) => value.system === identifier?.system && value.value === identifier?.value));
    if (existing) return Promise.resolve({ created: false, resource: structuredClone(existing) as T });
    const persisted = { ...structuredClone(resource), id: `${resource.resourceType.toLowerCase()}-${this.#next++}`, meta: { versionId: '1' } } as T;
    this.resources.set(`${persisted.resourceType}/${persisted.id}`, persisted);
    return Promise.resolve({ created: true, resource: structuredClone(persisted) });
  }
  create<T extends Resource>(plan: MutationPlan<T>): Promise<T> { void plan; return Promise.reject(new Error('not used')); }
  update<T extends Resource>(plan: MutationPlan<T>): Promise<T> { void plan; return Promise.reject(new Error('not used')); }
  read<T extends Resource>(reference: string): Promise<T | undefined> { return Promise.resolve(structuredClone(this.resources.get(reference)) as T | undefined); }
  searchByIdentifier<T extends Resource>(resourceType: T['resourceType'], identifier: Identifier): Promise<T[]> {
    return Promise.resolve([...this.resources.values()].filter((resource) => resource.resourceType === resourceType
      && identifiers(resource).some((value) => value.system === identifier.system && value.value === identifier.value)) as T[]);
  }
}

function identifiers(resource: Resource): Identifier[] {
  return 'identifier' in resource && Array.isArray(resource.identifier) ? resource.identifier : [];
}

describe('live Medplum baseline', () => {
  it('conditionally creates one reference-resolved schedulable baseline and returns actual hosted references', async () => {
    const repository = new BaselineRepository();
    const first = await ensureLiveMedplumBaseline(repository);
    const second = await ensureLiveMedplumBaseline(repository);

    expect(second).toEqual(first);
    expect(repository.resources.size).toBe(9);
    expect(first.healthcareServiceReference).toMatch(/^HealthcareService\//);
    expect(first.slotReference).toMatch(/^Slot\//);
    expect(first.insurerReference).toMatch(/^Organization\//);
    expect(first.providerReference).toMatch(/^PractitionerRole\//);
    const role = repository.resources.get(first.providerReference);
    expect(role?.resourceType === 'PractitionerRole' && role.extension).toContainEqual({
      url: 'http://hl7.org/fhir/StructureDefinition/timezone', valueCode: 'America/Chicago',
    });
    const schedule = [...repository.resources.values()].find((resource) => resource.resourceType === 'Schedule');
    expect(schedule?.resourceType === 'Schedule' && schedule.actor).toEqual([{ reference: first.providerReference }]);
    expect(schedule?.resourceType === 'Schedule' && schedule.serviceType?.[0]?.extension?.[0]?.valueReference?.reference)
      .toBe(first.healthcareServiceReference);
    expect(schedule?.resourceType === 'Schedule' && schedule.extension?.[0]?.extension)
      .toEqual(expect.arrayContaining([expect.objectContaining({ url: 'duration' })]));
    const slot = repository.resources.get(first.slotReference);
    expect(slot?.resourceType === 'Slot' && slot.schedule.reference).toBe(`Schedule/${schedule?.id}`);
  });
});
