import type {
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
} from '@medplum/fhirtypes';
import type { EligibilityAdapterResult } from '../contracts';
import { demoIdentifier } from './identifiers';

interface EligibilityContext {
  requestBusinessId: string;
  responseBusinessId: string;
  patientReference: string;
  coverageReference: string;
  insurerReference: string;
  providerReference: string;
  createdAt: string;
}

export function buildEligibilityRequest(input: EligibilityContext & { memberId: string }): CoverageEligibilityRequest {
  if (!input.memberId.trim()) {
    throw new Error('Eligibility requires a member ID');
  }
  return {
    resourceType: 'CoverageEligibilityRequest',
    identifier: [demoIdentifier('eligibility-request', input.requestBusinessId)],
    status: 'active',
    purpose: ['benefits'],
    patient: { reference: input.patientReference },
    created: input.createdAt,
    provider: { reference: input.providerReference },
    insurer: { reference: input.insurerReference },
    insurance: [{ coverage: { reference: input.coverageReference }, focal: true }],
  };
}

export function buildEligibilityResponse(input: Pick<EligibilityContext, 'responseBusinessId' | 'createdAt'> & {
  request: CoverageEligibilityRequest;
  result: EligibilityAdapterResult;
}): CoverageEligibilityResponse {
  if (input.result.outcome !== 'complete') {
    throw new Error('Only a completed adapter result can create eligibility evidence');
  }
  if (!input.request.id) {
    throw new Error('Eligibility response requires a persisted request');
  }
  const request = input.request;
  const coverage = request.insurance?.[0]?.coverage;
  const validPurpose = request.purpose?.length === 1 && request.purpose[0] === 'benefits';
  if (
    request.status !== 'active'
    || !validPurpose
    || !request.patient?.reference
    || !request.provider?.reference
    || !request.insurer?.reference
    || request.insurance?.length !== 1
    || request.insurance[0]?.focal !== true
    || !coverage?.reference
  ) {
    throw new Error('Eligibility response requires a complete and consistent persisted request');
  }
  const item = input.result.copay === undefined ? undefined : [{
    category: { coding: [{ system: 'urn:vibedoc:benefit-category', code: 'medical-care' }] },
    benefit: [{
      type: { coding: [{ system: 'urn:vibedoc:benefit-type', code: 'copay' }] },
      allowedMoney: { value: input.result.copay, currency: 'USD' as const },
    }],
  }];
  return {
    resourceType: 'CoverageEligibilityResponse',
    identifier: [
      demoIdentifier('eligibility-response', input.responseBusinessId),
      { system: 'urn:vibedoc:eligibility-source', value: `${input.result.source}:${input.result.transactionId}` },
    ],
    status: request.status,
    purpose: request.purpose,
    patient: request.patient,
    created: input.createdAt,
    request: { reference: `CoverageEligibilityRequest/${input.request.id}` },
    requestor: request.provider,
    insurer: request.insurer,
    outcome: 'complete',
    insurance: [{ coverage, inforce: input.result.active, ...(item ? { item } : {}) }],
  };
}

export type EligibilityProjection = {
  transaction: 'completed' | 'failed';
  source: 'fixture' | 'stedi-test' | 'unknown';
  active: { state: 'returned'; value: boolean } | { state: 'not-returned' };
  copay: { state: 'returned'; value: number } | { state: 'not-returned' };
};

export function projectEligibility(response: CoverageEligibilityResponse): EligibilityProjection {
  const sourceValue = response.identifier?.find((id) => id.system === 'urn:vibedoc:eligibility-source')?.value;
  const source = sourceValue?.startsWith('fixture:')
    ? 'fixture'
    : sourceValue?.startsWith('stedi-test:') ? 'stedi-test' : 'unknown';
  const inforce = response.insurance?.[0]?.inforce;
  const copayValue = response.insurance?.[0]?.item?.[0]?.benefit?.[0]?.allowedMoney?.value;
  return {
    transaction: response.outcome === 'complete' ? 'completed' : 'failed',
    source,
    active: inforce === undefined ? { state: 'not-returned' } : { state: 'returned', value: inforce },
    copay: copayValue === undefined ? { state: 'not-returned' } : { state: 'returned', value: copayValue },
  };
}
