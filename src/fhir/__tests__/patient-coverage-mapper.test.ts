import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import { buildDemoPatientCreate, buildDemoPatientIdentifier } from '../patient';
import { buildCoverage, planCoverageMemberIdUpdate } from '../coverage';

describe('Patient and Coverage mapping', () => {
  it('derives the synthetic Patient identifier server-side and supplies a conditional create', () => {
    const identifier = buildDemoPatientIdentifier();
    const create = buildDemoPatientCreate();

    expect(identifier).toEqual({
      system: DEMO_V1.identifierSystem,
      value: 'demo-v1:patient:maria-demo',
    });
    expect(create.ifNoneExist).toBe(
      `identifier=${encodeURIComponent(`${DEMO_V1.identifierSystem}|demo-v1:patient:maria-demo`)}`,
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
