import type { Task } from '@medplum/fhirtypes';
import { demoIdentifier, requireVersionedReference } from './identifiers';

const TASK_CODE_SYSTEM = 'urn:vibedoc:task-code';

interface OwnedDueTaskInput {
  taskBusinessId: string;
  practitionerRoleReference: string;
  dueStart: string;
  dueEnd: string;
}

function taskBase(input: OwnedDueTaskInput, code: string): Task {
  if (new Date(input.dueEnd).getTime() <= new Date(input.dueStart).getTime()) {
    throw new Error('Task due end must follow start');
  }
  return {
    resourceType: 'Task',
    identifier: [demoIdentifier('task', input.taskBusinessId)],
    status: 'requested',
    intent: 'order',
    code: { coding: [{ system: TASK_CODE_SYSTEM, code }] },
    owner: { reference: input.practitionerRoleReference },
    restriction: { period: { start: input.dueStart, end: input.dueEnd } },
  };
}

export function buildMissingMemberTask(input: OwnedDueTaskInput & {
  patientReference: string;
  questionnaireResponseReference: string;
  appointmentReference: string;
  coverageReference: string;
}): Task {
  return {
    ...taskBase(input, 'collect-missing-member-id'),
    for: { reference: input.patientReference },
    focus: { reference: input.questionnaireResponseReference },
    input: [
      {
        type: { coding: [{ system: 'urn:vibedoc:task-input', code: 'appointment' }] },
        valueReference: { reference: input.appointmentReference },
      },
      {
        type: { coding: [{ system: 'urn:vibedoc:task-input', code: 'coverage' }] },
        valueReference: { reference: input.coverageReference },
      },
    ],
  };
}

export function buildUncertainIdentityTask(input: OwnedDueTaskInput & { correlationId: string }): Task {
  if (!input.correlationId) {
    throw new Error('Uncertain identity Task requires correlation');
  }
  return taskBase(input, 'resolve-uncertain-identity');
}

export function planHumanTaskAcceptance(
  task: Task,
  actor: { actorType: 'human' | 'automation'; actorReference: string },
): { resource: Task; expectedVersion: string } {
  const versioned = requireVersionedReference(task);
  if (actor.actorType !== 'human' || actor.actorReference !== task.owner?.reference) {
    throw new Error('Only an authorized human may accept the Task');
  }
  if (task.status !== 'requested') {
    throw new Error('Only a requested Task may be accepted');
  }
  return { resource: { ...task, status: 'accepted' }, expectedVersion: versioned.versionId };
}
