import type { Provenance } from '@medplum/fhirtypes';
import { demoIdentifier } from './identifiers';

export function buildVersionedProvenance(input: {
  provenanceBusinessId: string;
  targetReference: string;
  targetVersionId: string;
  recordedAt: string;
  agentReference: string;
}): Provenance {
  if (!input.targetVersionId) {
    throw new Error('Provenance requires the committed target version');
  }
  return {
    resourceType: 'Provenance',
    extension: [{
      url: 'urn:vibedoc:provenance-business-identifier',
      valueIdentifier: demoIdentifier('provenance', input.provenanceBusinessId),
    }],
    target: [{ reference: `${input.targetReference}/_history/${input.targetVersionId}` }],
    recorded: input.recordedAt,
    agent: [{ who: { reference: input.agentReference } }],
  };
}

export function planPostCommitLineage(input: {
  mutationCommitted: boolean;
  committedReference?: string;
  committedVersionId?: string;
  provenanceExists: boolean;
}): { state: 'confirmed' | 'reconciling' | 'blocked'; retryMutation: false; createProvenance: boolean } {
  if (!input.mutationCommitted || !input.committedReference || !input.committedVersionId) {
    return { state: 'blocked', retryMutation: false, createProvenance: false };
  }
  if (input.provenanceExists) {
    return { state: 'confirmed', retryMutation: false, createProvenance: false };
  }
  return { state: 'reconciling', retryMutation: false, createProvenance: true };
}
