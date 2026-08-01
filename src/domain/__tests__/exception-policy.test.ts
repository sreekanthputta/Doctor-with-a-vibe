import { describe, expect, it } from 'vitest';
import { createStopOutcome } from '../exception-policy';

describe('exception policy', () => {
  it('atomically returns one owned requested exception command with stable idempotency', () => {
    const first = createStopOutcome('identity', 'run-77');
    const retry = createStopOutcome('identity', 'run-77');

    expect(first).toEqual(retry);
    expect(first.exceptionCommand).toMatchObject({
      type: 'create-identity-exception',
      workflowRunId: 'run-77',
      idempotencyKey: 'demo-v1:exception:identity:run-77',
      payload: {
        category: 'identity',
        status: 'requested',
        ownerQueue: 'PractitionerRole/maya-demo',
        duePolicy: 'demo-v1:exception-due-4h',
        safeSessionLabel: 'session-run-77',
      },
    });
    expect(first).not.toHaveProperty('patientRef');
  });
});
