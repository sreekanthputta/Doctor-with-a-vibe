import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import { decideDemoIdentity, resolveConditionalCreate } from '../identity-gate';

const maria = {
  kind: 'identity-submission' as const,
  givenName: DEMO_V1.patient.givenName,
  familyName: DEMO_V1.patient.familyName,
  birthDate: DEMO_V1.patient.birthDate,
  postalCode: DEMO_V1.patient.postalCode,
};

describe('demo identity gate', () => {
  it('derives the business identifier server-side for a new exact fixture identity', () => {
    expect(decideDemoIdentity(maria, [])).toEqual({
      outcome: 'verified-new-demo',
      patientBusinessId: DEMO_V1.patientBusinessId,
    });
  });

  it('binds one exact existing candidate with the derived identifier', () => {
    expect(decideDemoIdentity(maria, [{
      patientBusinessId: DEMO_V1.patientBusinessId,
      patientRef: 'Patient/123',
    }])).toEqual({
      outcome: 'exact-existing-demo',
      patientBusinessId: DEMO_V1.patientBusinessId,
    });
  });

  it.each([
    { ...maria, givenName: 'Marie' },
    { ...maria, birthDate: '1974-02-15' },
    { ...maria, postalCode: '60602' },
  ])('does not fuzzy-link near matches', (submission) => {
    expect(decideDemoIdentity(submission, [])).toMatchObject({ outcome: 'uncertain' });
  });

  it('binds no patient when multiple existing candidates are returned', () => {
    expect(decideDemoIdentity(maria, [
      { patientBusinessId: DEMO_V1.patientBusinessId, patientRef: 'Patient/1' },
      { patientBusinessId: DEMO_V1.patientBusinessId, patientRef: 'Patient/2' },
    ])).toEqual({ outcome: 'uncertain', exceptionCommandId: 'demo-v1:identity-exception:maria-demo' });
  });

  it('models concurrent exact requests converging after one conditional create wins', () => {
    const winner = resolveConditionalCreate(maria, { kind: 'created', patientRef: 'Patient/123' });
    const loser = resolveConditionalCreate(maria, {
      kind: 'conflict',
      rereadCandidates: [{ patientBusinessId: DEMO_V1.patientBusinessId, patientRef: 'Patient/123' }],
    });

    expect(winner).toEqual({ outcome: 'verified-new-demo', patientBusinessId: DEMO_V1.patientBusinessId });
    expect(loser).toEqual({ outcome: 'exact-existing-demo', patientBusinessId: DEMO_V1.patientBusinessId });
  });

  it('fails closed when a conditional-create conflict cannot be reread as one exact candidate', () => {
    expect(resolveConditionalCreate(maria, { kind: 'conflict', rereadCandidates: [] }))
      .toMatchObject({ outcome: 'uncertain' });
  });
});
