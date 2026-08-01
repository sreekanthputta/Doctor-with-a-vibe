import { describe, expect, it } from 'vitest';
import { DemoWorkflowStore } from '../../src/server/demo-workflow-store';

describe('DemoWorkflowStore vertical slice', () => {
  it('moves one validated request from empty to Needs attention to Ready', async () => {
    const store = new DemoWorkflowStore();
    expect(store.snapshot().phase).toBe('empty');

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

  it('fails closed on mixed clinical input with one exception and no appointment', async () => {
    const store = new DemoWorkflowStore();
    await store.submitRequest('I have chest pain and need an annual wellness visit');
    const stopped = store.snapshot();
    expect(stopped.phase).toBe('stopped');
    expect(stopped.exceptions).toHaveLength(1);
    expect(stopped.resourceEvidence.some((item) => item.resourceType === 'Appointment')).toBe(false);
    await store.submitRequest('I have chest pain and need an annual wellness visit');
    expect(store.snapshot().exceptions).toHaveLength(1);
  });

  it('cannot become Ready with a wrong or missing member ID', async () => {
    const store = new DemoWorkflowStore();
    await store.submitRequest('I need an annual wellness visit');
    await expect(store.submitMemberId('wrong')).rejects.toThrow(/member ID/i);
    expect(store.snapshot().phase).toBe('needs-attention');
  });
});
