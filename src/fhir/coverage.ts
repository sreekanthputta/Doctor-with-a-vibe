import type { Coverage } from '@medplum/fhirtypes';
import { demoIdentifier, requireVersionedReference } from './identifiers';

export function buildCoverage(input: {
  patientReference: string;
  payerDisplay: string;
  coverageBusinessId: string;
  memberId?: string;
}): Coverage {
  return {
    resourceType: 'Coverage',
    status: 'active',
    identifier: [demoIdentifier('coverage', input.coverageBusinessId)],
    beneficiary: { reference: input.patientReference },
    payor: [{ display: input.payerDisplay }],
    ...(input.memberId ? { subscriberId: input.memberId } : {}),
  };
}

export function planCoverageMemberIdUpdate(input: { coverage: Coverage; memberId: string }): {
  resource: Coverage;
  expectedVersion: string;
} {
  const versioned = requireVersionedReference(input.coverage);
  if (!input.memberId.trim()) {
    throw new Error('Coverage member ID is required');
  }
  return {
    resource: { ...input.coverage, subscriberId: input.memberId },
    expectedVersion: versioned.versionId,
  };
}
