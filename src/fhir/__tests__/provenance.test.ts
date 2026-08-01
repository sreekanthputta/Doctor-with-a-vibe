import { describe, expect, it } from 'vitest';
import { buildVersionedProvenance, planPostCommitLineage } from '../provenance';

describe('post-commit versioned Provenance', () => {
  it('targets the exact committed version and records the responsible agent', () => {
    const provenance = buildVersionedProvenance({
      provenanceBusinessId: 'provenance-workflow-1-coverage-5',
      targetReference: 'Coverage/coverage-1',
      targetVersionId: '5',
      recordedAt: '2026-08-01T15:00:01-05:00',
      agentReference: 'PractitionerRole/maya-role',
    });
    expect(provenance.target).toEqual([{ reference: 'Coverage/coverage-1/_history/5' }]);
    expect(provenance.agent?.[0]?.who.reference).toBe('PractitionerRole/maya-role');
  });

  it('keeps a committed mutation reconciling when lineage is missing and never retries the mutation', () => {
    expect(planPostCommitLineage({
      mutationCommitted: true,
      committedReference: 'Coverage/coverage-1',
      committedVersionId: '5',
      provenanceExists: false,
    })).toEqual({ state: 'reconciling', retryMutation: false, createProvenance: true });
  });

  it('blocks lineage confirmation without an exact committed version', () => {
    expect(planPostCommitLineage({
      mutationCommitted: true,
      committedReference: 'Coverage/coverage-1',
      provenanceExists: false,
    })).toEqual({ state: 'blocked', retryMutation: false, createProvenance: false });
  });
});
