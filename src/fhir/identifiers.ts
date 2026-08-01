import type { Identifier, Resource } from '@medplum/fhirtypes';
import { DEMO_V1 } from '../test/fixtures/demo-v1';

export function demoIdentifier(kind: string, value: string): Identifier {
  return {
    system: DEMO_V1.identifierSystem,
    value: `${DEMO_V1.identifierPrefix}${kind}:${value}`,
  };
}

export function requireVersionedReference(resource: Resource): { reference: string; versionId: string } {
  if (!resource.id || !resource.meta?.versionId) {
    throw new Error(`${resource.resourceType} requires id and versionId`);
  }
  return { reference: `${resource.resourceType}/${resource.id}`, versionId: resource.meta.versionId };
}
