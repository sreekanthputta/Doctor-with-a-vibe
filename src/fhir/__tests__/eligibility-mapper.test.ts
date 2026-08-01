import { describe, expect, it } from 'vitest';
import type { EligibilityAdapterResult } from '../../contracts';
import { buildEligibilityRequest, buildEligibilityResponse, projectEligibility } from '../eligibility';

const context = {
  requestBusinessId: 'eligibility-request-workflow-1',
  responseBusinessId: 'eligibility-response-workflow-1',
  patientReference: 'Patient/patient-1',
  coverageReference: 'Coverage/coverage-1',
  insurerReference: 'Organization/aetna',
  providerReference: 'Practitioner/maya',
  createdAt: '2026-08-01T15:00:00-05:00',
};

describe('Eligibility mapping', () => {
  it('refuses to create a request before a valid member ID exists', () => {
    expect(() => buildEligibilityRequest({ ...context, memberId: '' })).toThrow('Eligibility requires a member ID');
  });

  it('links a completed response to request, patient, coverage, insurer, and source transaction', () => {
    const request = { ...buildEligibilityRequest({ ...context, memberId: 'AETNA-DEMO-2048' }), id: 'cerq-1' };
    const result: EligibilityAdapterResult = {
      outcome: 'complete',
      source: 'fixture',
      transactionId: 'stedi-fixture-1',
      active: true,
    };
    const response = buildEligibilityResponse({ ...context, request, result });

    expect(response).toMatchObject({
      resourceType: 'CoverageEligibilityResponse',
      status: 'active',
      outcome: 'complete',
      request: { reference: 'CoverageEligibilityRequest/cerq-1' },
      patient: { reference: 'Patient/patient-1' },
      insurer: { reference: 'Organization/aetna' },
      requestor: { reference: 'Practitioner/maya' },
    });
    expect(response.identifier).toEqual(expect.arrayContaining([
      { system: 'urn:vibedoc:eligibility-source', value: 'fixture:stedi-fixture-1' },
    ]));
  });

  it('omits absent payer benefit values from FHIR and marks them not-returned only in the projection', () => {
    const request = { ...buildEligibilityRequest({ ...context, memberId: 'AETNA-DEMO-2048' }), id: 'cerq-1' };
    const result: EligibilityAdapterResult = {
      outcome: 'complete',
      source: 'fixture',
      transactionId: 'stedi-fixture-1',
      active: true,
    };
    const response = buildEligibilityResponse({ ...context, request, result });
    expect(JSON.stringify(response)).not.toContain('not-returned');
    expect(response.insurance?.[0]?.item).toBeUndefined();
    expect(projectEligibility(response)).toEqual({
      transaction: 'completed',
      source: 'fixture',
      active: { state: 'returned', value: true },
      copay: { state: 'not-returned' },
    });
  });

  it('does not map a failed adapter result as completed evidence', () => {
    const request = { ...buildEligibilityRequest({ ...context, memberId: 'AETNA-DEMO-2048' }), id: 'cerq-1' };
    expect(() => buildEligibilityResponse({
      ...context,
      request,
      result: { outcome: 'error', source: 'fixture', transactionId: 'failed-1' },
    })).toThrow('Only a completed adapter result can create eligibility evidence');
  });
});
