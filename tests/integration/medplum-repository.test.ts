import { describe, expect, it, vi } from 'vitest';
import type { Bundle, Patient } from '@medplum/fhirtypes';
import { MedplumFhirRepository } from '../../src/adapters/medplum-fhir-repository';
import { buildMutationPlan } from '../../src/fhir/repository';

describe('MedplumFhirRepository', () => {
  it('performs conditional create as one FHIR transaction', async () => {
    const patient: Patient = { resourceType: 'Patient', identifier: [{ system: 'urn:vibedoc:demo', value: 'demo-v1:patient:maria' }] };
    const persisted: Patient = { ...patient, id: 'patient-1', meta: { versionId: '1' } };
    const executeBatch = vi.fn((bundle: Bundle) => Promise.resolve({
      resourceType: 'Bundle' as const,
      type: 'transaction-response' as const,
      entry: [{ resource: persisted, response: { status: '201 Created' } }],
      _request: bundle,
    }));
    const repository = new MedplumFhirRepository({ executeBatch } as never);

    const result = await repository.conditionalCreate(patient, 'identifier=urn:vibedoc:demo|demo-v1:patient:maria');
    expect(result).toEqual({ created: true, resource: persisted });
    const calledRequest = executeBatch.mock.calls[0]?.[0].entry?.[0]?.request;
    expect(calledRequest).toMatchObject({ method: 'POST', url: 'Patient' });
    expect(calledRequest?.ifNoneExist).toContain('identifier=');
  });

  it('uses If-Match for version-aware updates', async () => {
    const patient: Patient = { resourceType: 'Patient', id: 'patient-1', meta: { versionId: '4' } };
    const updateResource = vi.fn((resource: Patient, options?: { headers?: Record<string, string> }) => {
      void options;
      return Promise.resolve({ ...resource, meta: { versionId: '5' } });
    });
    const repository = new MedplumFhirRepository({ updateResource } as never);
    const plan = buildMutationPlan({ workflow: 'ready-visit', operation: 'update', resource: patient, idempotencyKey: 'update-1', expectedVersion: '4' });

    await repository.update(plan);
    expect(updateResource.mock.calls[0]?.[1]?.headers?.['If-Match']).toBe('W/"4"');
  });
});
