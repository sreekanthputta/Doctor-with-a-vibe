import { describe, expect, it } from 'vitest';
import { reconcileMutation } from '../repository';

describe('mutation response-loss reconciliation', () => {
  it('returns the one committed resource found by business identifier without replaying the write', async () => {
    const result = await reconcileMutation({
      businessIdentifier: { system: 'urn:vibedoc:demo', value: 'demo-v1:coverage:workflow-1' },
      search: () => Promise.resolve([{ resourceType: 'Coverage', id: 'coverage-1', meta: { versionId: '4' }, status: 'active', beneficiary: { reference: 'Patient/p-1' }, payor: [{ display: 'Aetna' }] }]),
    });
    expect(result).toMatchObject({ state: 'committed', retryMutation: false, resource: { id: 'coverage-1' } });
  });

  it('blocks ambiguous duplicate resources', async () => {
    const resources = [
      { resourceType: 'Coverage' as const, id: 'coverage-1', status: 'active' as const, beneficiary: { reference: 'Patient/p-1' }, payor: [{ display: 'Aetna' }] },
      { resourceType: 'Coverage' as const, id: 'coverage-2', status: 'active' as const, beneficiary: { reference: 'Patient/p-1' }, payor: [{ display: 'Aetna' }] },
    ];
    expect(await reconcileMutation({
      businessIdentifier: { system: 'urn:vibedoc:demo', value: 'demo-v1:coverage:workflow-1' },
      search: () => Promise.resolve(resources),
    })).toEqual({ state: 'blocked', retryMutation: false, reason: 'ambiguous-identifier' });
  });
});
