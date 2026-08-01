import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import { buildDemoPatientCreate, buildDemoPatientIdentifier } from '../patient';
import { buildCoverage, planCoverageMemberIdUpdate } from '../coverage';
import { decideDemoIdentity } from '../../domain/identity-gate';

describe('Patient and Coverage mapping', () => {
  it('derives the synthetic Patient identifier server-side and supplies a conditional create', () => {
    const identifier = buildDemoPatientIdentifier();
    const create = buildDemoPatientCreate();

    expect(identifier).toEqual({
      system: DEMO_V1.identifierSystem,
      value: DEMO_V1.patientBusinessId,
    });
    expect(create.ifNoneExist).toBe(
      `identifier=${encodeURIComponent(`${DEMO_V1.identifierSystem}|${DEMO_V1.patientBusinessId}`)}`,
    );
    expect(create.resource).toMatchObject({
      resourceType: 'Patient',
      active: true,
      identifier: [identifier],
      name: [{ family: 'Lopez', given: ['Maria'] }],
      birthDate: '1974-02-14',
      address: [{ postalCode: '60601' }],
    });
  });

  it('uses exactly the same business identifier as the identity decision', () => {
    const decision = decideDemoIdentity({
      kind: 'identity-submission',
      givenName: DEMO_V1.patient.givenName,
      familyName: DEMO_V1.patient.familyName,
      birthDate: DEMO_V1.patient.birthDate,
      postalCode: DEMO_V1.patient.postalCode,
    }, []);
    expect(decision.outcome).toBe('verified-new-demo');
    expect(buildDemoPatientCreate().resource.identifier?.[0]?.value).toBe(
      decision.outcome === 'uncertain' ? undefined : decision.patientBusinessId,
    );
  });

  it('creates Coverage without inventing a member ID and plans a guarded update', () => {
    const coverage = buildCoverage({
      patientReference: 'Patient/patient-1',
      payerDisplay: 'Aetna',
      coverageBusinessId: 'coverage-maria-aetna',
    });

    expect(coverage).toMatchObject({
      resourceType: 'Coverage',
      status: 'active',
      beneficiary: { reference: 'Patient/patient-1' },
      payor: [{ display: 'Aetna' }],
    });
    expect(coverage.subscriberId).toBeUndefined();

    const update = planCoverageMemberIdUpdate({
      coverage: { ...coverage, id: 'coverage-1', meta: { versionId: '4' } },
      memberId: DEMO_V1.memberId,
    });
    expect(update.expectedVersion).toBe('4');
    expect(update.resource.subscriberId).toBe(DEMO_V1.memberId);
  });

  it('rejects an unversioned Coverage update', () => {
    const coverage = buildCoverage({
      patientReference: 'Patient/patient-1',
      payerDisplay: 'Aetna',
      coverageBusinessId: 'coverage-maria-aetna',
    });
    expect(() => planCoverageMemberIdUpdate({ coverage, memberId: DEMO_V1.memberId })).toThrow(
      'Coverage requires id and versionId',
    );
  });
});
