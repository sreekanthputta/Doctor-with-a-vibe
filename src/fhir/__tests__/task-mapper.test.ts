import { describe, expect, it } from 'vitest';
import { buildMissingMemberTask, buildUncertainIdentityTask, planHumanTaskAcceptance } from '../tasks';

const taskContext = {
  practitionerRoleReference: 'PractitionerRole/maya-role',
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
      owner: { reference: 'PractitionerRole/maya-role' },
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
      owner: { reference: 'PractitionerRole/maya-role' },
    });
    expect(task.for).toBeUndefined();
    expect(task.focus).toBeUndefined();
    expect(task.input).toBeUndefined();
    expect(JSON.stringify(task)).not.toMatch(/Maria|Lopez|1974|60601|Patient\//);
    expect(task.identifier?.some((id) => id.value === 'correlation-1')).toBe(false);
  });

  it('allows only the human physician role to acknowledge a requested exception', () => {
    const task = { ...buildUncertainIdentityTask({ ...taskContext, taskBusinessId: 'identity-1', correlationId: 'c-1' }), id: 'task-1', meta: { versionId: '3' } };
    expect(() => planHumanTaskAcceptance(task, { actorType: 'automation', actorReference: 'Device/agent' })).toThrow(
      'Only an authorized human may accept the Task',
    );
    const acceptance = planHumanTaskAcceptance(task, {
      actorType: 'human',
      actorReference: 'PractitionerRole/maya-role',
    });
    expect(acceptance.expectedVersion).toBe('3');
    expect(acceptance.resource.status).toBe('accepted');
  });
});
