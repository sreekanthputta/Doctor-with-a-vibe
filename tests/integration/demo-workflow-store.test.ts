import { describe, expect, it } from 'vitest';
import { DemoWorkflowStore } from '../../src/server/demo-workflow-store';
import type { DemoPersistence, DemoPersistenceSnapshot } from '../../src/server/demo-persistence';

class RecordingPersistence implements DemoPersistence {
  readonly calls: string[] = [];

  start(): Promise<DemoPersistenceSnapshot> {
    this.calls.push('start');
    return Promise.resolve({
      phase: 'needs-attention',
      evidence: [{ resourceType: 'Appointment', reference: 'Appointment/live-1', version: '7', sourceUpdatedAt: '2026-08-01T18:00:00Z', workflowRole: 'Scheduling' }],
    });
  }

  complete(memberId: string): Promise<DemoPersistenceSnapshot> {
    this.calls.push(`complete:${memberId}`);
    return Promise.resolve({
      phase: 'ready',
      evidence: [
        { resourceType: 'Appointment', reference: 'Appointment/live-1', version: '1', sourceUpdatedAt: '2026-08-01T18:01:00Z', workflowRole: 'Scheduling' },
        { resourceType: 'Coverage', reference: 'Coverage/live-1', version: '2', sourceUpdatedAt: '2026-08-01T18:01:00Z', workflowRole: 'Coverage' },
        { resourceType: 'QuestionnaireResponse', reference: 'QuestionnaireResponse/live-1', version: '2', sourceUpdatedAt: '2026-08-01T18:01:00Z', workflowRole: 'Patient-reported intake' },
        { resourceType: 'Task', reference: 'Task/live-1', version: '2', sourceUpdatedAt: '2026-08-01T18:01:00Z', workflowRole: 'Owned exception' },
        { resourceType: 'CoverageEligibilityRequest', reference: 'CoverageEligibilityRequest/live-1', version: '1', sourceUpdatedAt: '2026-08-01T18:01:00Z', workflowRole: 'Eligibility input' },
        { resourceType: 'CoverageEligibilityResponse', reference: 'CoverageEligibilityResponse/live-2', version: '3', sourceUpdatedAt: '2026-08-01T18:01:00Z', workflowRole: 'Eligibility evidence' },
        { resourceType: 'Provenance', reference: 'Provenance/live-1', version: '1', sourceUpdatedAt: '2026-08-01T18:01:00Z', workflowRole: 'Version lineage' },
      ],
    });
  }

  recordUncertainIdentity(correlationId: string): Promise<DemoPersistenceSnapshot> {
    this.calls.push(`uncertain:${correlationId}`);
    return Promise.resolve({
      phase: 'stopped',
      evidence: [{ resourceType: 'Task', reference: 'Task/uncertain-1', version: '1', sourceUpdatedAt: '2026-08-01T18:00:00Z', workflowRole: 'Owned exception' }],
    });
  }

  recordException(category: string, correlationId: string): Promise<DemoPersistenceSnapshot> {
    this.calls.push(`exception:${category}:${correlationId}`);
    return Promise.resolve({ phase: 'stopped', evidence: [] });
  }

  acknowledgeException(): Promise<DemoPersistenceSnapshot> {
    this.calls.push('acknowledge');
    return Promise.resolve({ phase: 'stopped', evidence: [] });
  }

  reset(): Promise<{ deletedCount: number; verified: true }> {
    this.calls.push('reset');
    return Promise.resolve({ deletedCount: 2, verified: true });
  }
}

async function verifyMaria(store: DemoWorkflowStore): Promise<void> {
  await store.submitIdentity({ givenName: 'Maria', familyName: 'Lopez', birthDate: '1974-02-14', postalCode: '60601' });
}

describe('DemoWorkflowStore vertical slice', () => {
  it('moves one validated request from empty to Needs attention to Ready', async () => {
    const store = new DemoWorkflowStore();
    expect(store.snapshot().phase).toBe('empty');
    await verifyMaria(store);

    await store.submitRequest('I need an annual wellness visit in the morning');
    const needsAttention = store.snapshot();
    expect(needsAttention.phase).toBe('needs-attention');
    expect(needsAttention.visit?.openRequiredTaskCount).toBe(1);
    expect(needsAttention.resourceEvidence.map((item) => item.resourceType)).toEqual(expect.arrayContaining(['Patient', 'Appointment', 'Coverage', 'QuestionnaireResponse', 'Task']));

    await store.submitMemberId('AETNA-DEMO-2048');
    const ready = store.snapshot();
    expect(ready.phase).toBe('ready');
    expect(ready.visit).toMatchObject({ status: 'ready', openRequiredTaskCount: 0, eligibilityTransaction: 'completed' });
    expect(ready.resourceEvidence.map((item) => item.resourceType)).toEqual(expect.arrayContaining(['CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'Provenance']));
  });

  it('refuses Ready when persistence omits required committed evidence', async () => {
    const persistence = new RecordingPersistence();
    persistence.complete = () => Promise.resolve({
      phase: 'ready',
      evidence: [{ resourceType: 'CoverageEligibilityResponse', reference: 'CoverageEligibilityResponse/incomplete', version: '1', sourceUpdatedAt: '2026-08-01T18:01:00Z', workflowRole: 'Eligibility evidence' }],
    });
    const store = new DemoWorkflowStore(undefined, undefined, persistence);
    await verifyMaria(store);
    await store.submitRequest('I need an annual wellness visit');

    await expect(store.submitMemberId('AETNA-DEMO-2048')).rejects.toThrow(/required persisted evidence/i);
    expect(store.snapshot().phase).toBe('needs-attention');
  });

  it('uses reread persistence evidence for the visible workflow and reset', async () => {
    const persistence = new RecordingPersistence();
    const store = new DemoWorkflowStore(undefined, undefined, persistence);
    await verifyMaria(store);

    await store.submitRequest('I need an annual wellness visit');
    expect(store.snapshot().resourceEvidence).toEqual([expect.objectContaining({ reference: 'Appointment/live-1', version: '7' })]);
    await store.submitMemberId('AETNA-DEMO-2048');
    expect(store.snapshot().resourceEvidence).toEqual(expect.arrayContaining([expect.objectContaining({ reference: 'CoverageEligibilityResponse/live-2', version: '3' })]));
    await store.reset();
    expect(persistence.calls).toEqual(['start', 'complete:AETNA-DEMO-2048', 'reset']);
  });

  it('fails closed on mixed clinical input with one exception and no appointment', async () => {
    const store = new DemoWorkflowStore();
    await verifyMaria(store);
    await store.submitRequest('I have chest pain and need an annual wellness visit');
    const stopped = store.snapshot();
    expect(stopped.phase).toBe('stopped');
    expect(stopped.exceptions).toHaveLength(1);
    expect(stopped.resourceEvidence.some((item) => item.resourceType === 'Appointment')).toBe(false);
    await store.submitRequest('I have chest pain and need an annual wellness visit');
    expect(store.snapshot().exceptions).toHaveLength(1);
  });

  it('persists a mixed clinical stop before returning its owned exception', async () => {
    const persistence = new RecordingPersistence();
    const store = new DemoWorkflowStore(undefined, undefined, persistence);
    await verifyMaria(store);

    const stopped = await store.submitRequest('I have chest pain and need an annual wellness visit');

    expect(stopped.phase).toBe('stopped');
    expect(persistence.calls).toContainEqual(expect.stringMatching(/^exception:mixed-clinical-administrative:/));
    expect(persistence.calls).not.toContain('start');
  });

  it('preserves an unmatched administrative category and neutral stop copy', async () => {
    const store = new DemoWorkflowStore();
    await verifyMaria(store);
    await store.submitRequest('I need an annual welness vist');
    const stopped = store.snapshot();
    expect(stopped.exceptions[0]?.category).toBe('administrative-unmatched');
    expect(stopped.stopCopy).toMatch(/could not complete that administrative request/i);
    expect(stopped.stopCopy).not.toMatch(/call 911/i);
  });

  it('cannot become Ready with a wrong or missing member ID', async () => {
    const store = new DemoWorkflowStore();
    await verifyMaria(store);
    await store.submitRequest('I need an annual wellness visit');
    await expect(store.submitMemberId('wrong')).rejects.toThrow(/member ID/i);
    expect(store.snapshot().phase).toBe('needs-attention');
  });

  it('stops an uncertain identity without Patient or Appointment evidence', async () => {
    const store = new DemoWorkflowStore();
    const stopped = await store.submitUncertainIdentityReplay();
    expect(stopped.phase).toBe('stopped');
    expect(stopped.exceptions).toEqual([expect.objectContaining({ category: 'identity', status: 'requested' })]);
    expect(stopped.resourceEvidence).toEqual([]);
    expect(JSON.stringify(stopped)).not.toContain('Maria');
  });
});
