import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import { buildExceptionTask, buildMissingMemberTask, buildUncertainIdentityTask, planHumanTaskAcceptance } from '../tasks';

const taskContext = {
  dueStart: '2026-08-01T15:00:00-05:00',
  dueEnd: '2026-08-02T15:00:00-05:00',
};

describe('Task profiles', () => {
  it('creates one owned, due, requested missing-member Task linked to workflow resources', () => {
    const task = buildMissingMemberTask({
      ...taskContext,
      taskBusinessId: 'missing-member-workflow-1',
      patientReference: 'Patient/patient-1',
      questionnaireResponseReference: 'QuestionnaireResponse/qr-1',
      appointmentReference: 'Appointment/appt-1',
      coverageReference: 'Coverage/coverage-1',
    });

    expect(task).toMatchObject({
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      code: { coding: [{ system: 'urn:vibedoc:task-code', code: 'collect-missing-member-id' }] },
      for: { reference: 'Patient/patient-1' },
      focus: { reference: 'QuestionnaireResponse/qr-1' },
      owner: { reference: DEMO_V1.practitionerRoleReference },
      restriction: { period: { start: taskContext.dueStart, end: taskContext.dueEnd } },
    });
    expect(task.input).toEqual([
      {
        type: { coding: [{ system: 'urn:vibedoc:task-input', code: 'appointment' }] },
        valueReference: { reference: 'Appointment/appt-1' },
      },
      {
        type: { coding: [{ system: 'urn:vibedoc:task-input', code: 'coverage' }] },
        valueReference: { reference: 'Coverage/coverage-1' },
      },
    ]);
  });

  it('creates an uncertain-identity Task with no candidate or Patient PHI', () => {
    const task = buildUncertainIdentityTask({
      ...taskContext,
      taskBusinessId: 'identity-exception-session-1',
      correlationId: 'correlation-1',
    });

    expect(task).toMatchObject({
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      code: { coding: [{ system: 'urn:vibedoc:task-code', code: 'resolve-uncertain-identity' }] },
      owner: { reference: DEMO_V1.practitionerRoleReference },
    });
    expect(task.for).toBeUndefined();
    expect(task.focus).toBeUndefined();
    expect(task.input).toBeUndefined();
    expect(JSON.stringify(task)).not.toMatch(/Maria|Lopez|1974|60601|Patient\//);
    expect(task.identifier?.some((id) => id.value === 'correlation-1')).toBe(false);
  });

  it('preserves a generic exception category while remaining human-owned, due, requested, and unbound', () => {
    const task = buildExceptionTask({
      ...taskContext,
      taskBusinessId: 'exception-session-2',
      category: 'unsupported-administrative-intent',
    });
    expect(task).toMatchObject({
      status: 'requested',
      owner: { reference: DEMO_V1.practitionerRoleReference },
      code: { coding: [{ system: 'urn:vibedoc:task-code', code: 'unsupported-administrative-intent' }] },
      restriction: { period: { start: taskContext.dueStart, end: taskContext.dueEnd } },
    });
    expect(task.for).toBeUndefined();
    expect(task.focus).toBeUndefined();
    expect(task.input).toBeUndefined();
  });

  it('rejects malformed or reversed Task due timestamps', () => {
    expect(() => buildExceptionTask({ ...taskContext, taskBusinessId: 'bad-time', category: 'uncertain-identity', dueStart: 'not-a-date' }))
      .toThrow('valid ISO');
    expect(() => buildExceptionTask({ ...taskContext, taskBusinessId: 'bad-order', category: 'uncertain-identity', dueEnd: taskContext.dueStart }))
      .toThrow('follow start');
  });

  it('allows only the human physician role to acknowledge a requested exception', () => {
    const task = { ...buildUncertainIdentityTask({ ...taskContext, taskBusinessId: 'identity-1', correlationId: 'c-1' }), id: 'task-1', meta: { versionId: '3' } };
    expect(() => planHumanTaskAcceptance(task, { actorType: 'automation', actorReference: 'Device/agent' })).toThrow(
      'Only an authorized human may accept the Task',
    );
    const acceptance = planHumanTaskAcceptance(task, {
      actorType: 'human',
      actorReference: DEMO_V1.practitionerRoleReference,
    });
    expect(acceptance.expectedVersion).toBe('3');
    expect(acceptance.resource.status).toBe('accepted');
  });
});
