import { describe, expect, it } from 'vitest';
import { createWorkflowState, reduceWorkflow } from '../workflow-reducer';

describe('deterministic workflow reducer', () => {
  it('orders missing-member resolution as coverage, eligibility, Task completion, then Ready', () => {
    let state = createWorkflowState('run-1');
    state = reduceWorkflow(state, { type: 'identity-verified' });
    state = reduceWorkflow(state, { type: 'appointment-booked' });
    state = reduceWorkflow(state, { type: 'intake-saved', complete: false });

    expect(state.stage).toBe('needs-attention');
    expect(state.eligibility.state).toBe('not-run');
    expect(state.requiredTaskStatus).toBe('requested');

    expect(() => reduceWorkflow(state, { type: 'eligibility-started' })).toThrow('member-id-required-before-eligibility');
    state = reduceWorkflow(state, { type: 'member-id-supplied' });
    state = reduceWorkflow(state, { type: 'coverage-updated' });
    state = reduceWorkflow(state, { type: 'eligibility-started' });
    state = reduceWorkflow(state, { type: 'eligibility-persisted', linked: true, sourceIdentifierValid: true, outcomeAccepted: true });

    expect(state.stage).toBe('needs-attention');
    expect(state.requiredTaskStatus).toBe('requested');
    state = reduceWorkflow(state, { type: 'intake-completed' });
    state = reduceWorkflow(state, { type: 'required-task-completed' });
    expect(state.stage).toBe('ready');
  });

  it('keeps Needs attention when eligibility persistence is partial or malformed', () => {
    let state = createWorkflowState('run-2');
    for (const event of [
      { type: 'identity-verified' as const },
      { type: 'appointment-booked' as const },
      { type: 'intake-saved' as const, complete: false },
      { type: 'member-id-supplied' as const },
      { type: 'coverage-updated' as const },
      { type: 'eligibility-started' as const },
      { type: 'eligibility-persisted' as const, linked: false, sourceIdentifierValid: true, outcomeAccepted: true },
    ]) state = reduceWorkflow(state, event);

    expect(state.stage).toBe('needs-attention');
    expect(state.eligibility.state).toBe('failed');
    expect(state.requiredTaskStatus).toBe('requested');
    expect(() => reduceWorkflow(state, { type: 'required-task-completed' })).toThrow('required-task-resolution-not-persisted');
  });

  it('stops atomically and cannot later schedule', () => {
    const state = reduceWorkflow(createWorkflowState('run-3'), {
      type: 'stopped',
      category: 'clinical-language',
    });
    expect(state.stage).toBe('stopped');
    expect(state.exceptionCommand?.idempotencyKey).toBe('demo-v1:exception:clinical-language:run-3');
    expect(() => reduceWorkflow(state, { type: 'appointment-booked' })).toThrow('workflow-stopped');
  });
});
