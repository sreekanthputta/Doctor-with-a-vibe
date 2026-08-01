import { describe, expect, it } from 'vitest';
import { buildMutationPlan, type FhirRepository } from '../repository';

describe('central mutation plan', () => {
  it('allows only workflow-scoped resource types and carries idempotency/version conditions', () => {
    const plan = buildMutationPlan({
      workflow: 'ready-visit',
      operation: 'update',
      resource: { resourceType: 'Coverage', id: 'coverage-1', meta: { versionId: '5' }, status: 'active', beneficiary: { reference: 'Patient/patient-1' }, payor: [{ display: 'Aetna' }] },
      idempotencyKey: 'command-1',
      expectedVersion: '5',
    });
    expect(plan).toMatchObject({ workflow: 'ready-visit', operation: 'update', idempotencyKey: 'command-1', expectedVersion: '5' });
  });

  it('rejects arbitrary clinical writes', () => {
    expect(() => buildMutationPlan({
      workflow: 'ready-visit',
      operation: 'create',
      resource: { resourceType: 'MedicationRequest', status: 'draft', intent: 'order', subject: { reference: 'Patient/patient-1' }, medicationCodeableConcept: { text: 'unsafe' } },
      idempotencyKey: 'command-2',
    })).toThrow('Resource type MedicationRequest is not allowed for ready-visit');
  });

  it('rejects a stale or unidentifiable update plan', () => {
    expect(() => buildMutationPlan({
      workflow: 'ready-visit',
      operation: 'update',
      resource: { resourceType: 'Coverage', id: 'coverage-1', meta: { versionId: '4' }, status: 'active', beneficiary: { reference: 'Patient/patient-1' }, payor: [{ display: 'Aetna' }] },
      idempotencyKey: 'command-3',
      expectedVersion: '5',
    })).toThrow('Expected version does not match the resource version');
  });

  it('defines repository ports without a network implementation', () => {
    const repository: FhirRepository = {
      conditionalCreate: (resource, ifNoneExist) => {
        expect(ifNoneExist).toBeTypeOf('string');
        return Promise.resolve({ created: true, resource });
      },
      create: (plan) => Promise.resolve(plan.resource),
      update: (plan) => Promise.resolve(plan.resource),
      read: () => Promise.resolve(undefined),
      searchByIdentifier: () => Promise.resolve([]),
    };
    expect(repository).toBeDefined();
  });
});
