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
    const response = buildEligibilityResponse({
      responseBusinessId: context.responseBusinessId,
      createdAt: context.createdAt,
      request,
      result,
    });

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
    const response = buildEligibilityResponse({ responseBusinessId: context.responseBusinessId, createdAt: context.createdAt, request, result });
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
      responseBusinessId: context.responseBusinessId,
      createdAt: context.createdAt,
      request,
      result: { outcome: 'error', source: 'fixture', transactionId: 'failed-1' },
    })).toThrow('Only a completed adapter result can create eligibility evidence');
  });

  it('derives all linkage and purpose fields from the persisted request and round-trips a returned copay', () => {
    const request = {
      ...buildEligibilityRequest({ ...context, memberId: 'AETNA-DEMO-2048' }),
      id: 'cerq-1',
      meta: { versionId: '3' },
    };
    const response = buildEligibilityResponse({
      responseBusinessId: context.responseBusinessId,
      createdAt: context.createdAt,
      request,
      result: { outcome: 'complete', source: 'fixture', transactionId: 'copay-1', active: true, copay: 40 },
    });
    expect(response).toMatchObject({
      status: request.status,
      purpose: request.purpose,
      patient: request.patient,
      insurer: request.insurer,
      requestor: request.provider,
      insurance: [{ coverage: request.insurance?.[0]?.coverage, inforce: true }],
    });
    expect(response.insurance?.[0]?.item?.[0]?.benefit?.[0]).toMatchObject({
      type: { coding: [{ system: 'urn:vibedoc:benefit-type', code: 'copay' }] },
      allowedMoney: { value: 40, currency: 'USD' },
    });
    expect(projectEligibility(response).copay).toEqual({ state: 'returned', value: 40 });
  });

  it('rejects an incomplete or inconsistent persisted eligibility request', () => {
    const request = { ...buildEligibilityRequest({ ...context, memberId: 'AETNA-DEMO-2048' }), id: 'cerq-1' };
    const common = {
      responseBusinessId: context.responseBusinessId,
      createdAt: context.createdAt,
      result: { outcome: 'complete', source: 'fixture', transactionId: 'invalid-request' } as const,
    };
    expect(() => buildEligibilityResponse({ ...common, request: { ...request, patient: undefined } as never }))
      .toThrow('persisted request');
    expect(() => buildEligibilityResponse({ ...common, request: { ...request, purpose: ['discovery'] } }))
      .toThrow('persisted request');
    expect(() => buildEligibilityResponse({ ...common, request: { ...request, insurance: [] } }))
      .toThrow('persisted request');
  });
});
