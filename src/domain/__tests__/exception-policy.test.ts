import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import { createStopOutcome } from '../exception-policy';

describe('exception policy', () => {
  it('atomically returns one owned requested exception command with stable idempotency', () => {
    const first = createStopOutcome('identity', 'run-77');
    const retry = createStopOutcome('identity', 'run-77');

    expect(first).toEqual(retry);
    expect(first.exceptionCommand).toMatchObject({
      type: 'create-exception',
      workflowRunId: 'run-77',
      idempotencyKey: 'demo-v1:exception:identity:run-77',
      payload: {
        category: 'identity',
        status: 'requested',
        ownerQueue: DEMO_V1.practitionerRoleReference,
        duePolicy: 'demo-v1:exception-due-4h',
        safeSessionLabel: 'session-run-77',
      },
    });
    expect(first).not.toHaveProperty('patientRef');
  });

  it('uses emergency copy only for clinical and mixed-language stops', () => {
    const clinical = createStopOutcome('clinical-language', 'run-clinical');
    const mixed = createStopOutcome('mixed-clinical-administrative', 'run-mixed');
    const unmatched = createStopOutcome('administrative-unmatched', 'run-unmatched');
    const identity = createStopOutcome('identity', 'run-identity');

    expect(clinical.safeCopy).toBe(mixed.safeCopy);
    expect(unmatched.safeCopy).not.toBe(clinical.safeCopy);
    expect(identity.safeCopy).toBe(unmatched.safeCopy);
    expect(identity.exceptionCommand.payload).toMatchObject({ category: 'identity' });
  });
});
