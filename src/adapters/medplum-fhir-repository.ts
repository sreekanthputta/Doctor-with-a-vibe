import type { Bundle, Identifier, Resource, ResourceType } from '@medplum/fhirtypes';
import type { MedplumClient } from '@medplum/core';
import type { FhirRepository, MutationPlan } from '../fhir/repository';

type MedplumTransport = Pick<MedplumClient, 'executeBatch' | 'createResource' | 'updateResource' | 'readResource' | 'searchResources'>;

export class MedplumFhirRepository implements FhirRepository {
  constructor(private readonly client: MedplumTransport) {}

  async conditionalCreate<T extends Resource>(resource: T, ifNoneExist: string): Promise<{ created: boolean; resource: T }> {
    const request: Bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [{ resource, request: { method: 'POST', url: resource.resourceType, ifNoneExist } }],
    };
    const response = await this.client.executeBatch(request);
    const entry = response.entry?.[0];
    if (!entry?.resource) throw new Error('Conditional create returned no resource');
    const status = entry.response?.status ?? '';
    if (!status.startsWith('200') && !status.startsWith('201')) throw new Error(`Conditional create failed: ${status || 'unknown status'}`);
    return { created: status.startsWith('201'), resource: entry.resource as T };
  }

  create<T extends Resource>(plan: MutationPlan<T>): Promise<T> {
    return this.client.createResource(plan.resource, {
      headers: { 'X-VibeDoc-Idempotency-Key': plan.idempotencyKey },
    });
  }

  update<T extends Resource>(plan: MutationPlan<T>): Promise<T> {
    if (!plan.expectedVersion) throw new Error('Expected version is required');
    return this.client.updateResource(plan.resource, {
      headers: {
        'If-Match': `W/"${plan.expectedVersion}"`,
        'X-VibeDoc-Idempotency-Key': plan.idempotencyKey,
      },
    });
  }

  async read<T extends Resource>(reference: string): Promise<T | undefined> {
    const [resourceType, id, extra] = reference.split('/');
    if (!resourceType || !id || extra) throw new Error('FHIR reference must be ResourceType/id');
    try {
      return await this.client.readResource(resourceType as ResourceType, id) as T;
    } catch (error) {
      if (error instanceof Error && /not found|404/i.test(error.message)) return undefined;
      throw error;
    }
  }

  async searchByIdentifier<T extends Resource>(resourceType: T['resourceType'], identifier: Identifier): Promise<T[]> {
    if (!identifier.system || !identifier.value) throw new Error('Identifier system and value are required');
    return await this.client.searchResources(resourceType, {
      identifier: `${identifier.system}|${identifier.value}`,
    }) as unknown as T[];
  }
}
