import type { Task } from '@medplum/fhirtypes';
import { DEMO_V1 } from '../test/fixtures/demo-v1';
import { demoIdentifier, requireVersionedReference } from './identifiers';

const TASK_CODE_SYSTEM = 'urn:vibedoc:task-code';

interface OwnedDueTaskInput {
  taskBusinessId: string;
  dueStart: string;
  dueEnd: string;
  ownerReference?: string;
}

function requireIsoInstant(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error('Task due timestamps must be valid ISO datetimes');
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error('Task due timestamps must be valid ISO datetimes');
  return timestamp;
}

function taskBase(input: OwnedDueTaskInput, code: string): Task {
  const start = requireIsoInstant(input.dueStart);
  const end = requireIsoInstant(input.dueEnd);
  if (end <= start) {
    throw new Error('Task due end must follow start');
  }
  return {
    resourceType: 'Task',
    identifier: [demoIdentifier('task', input.taskBusinessId)],
    status: 'requested',
    intent: 'order',
    code: { coding: [{ system: TASK_CODE_SYSTEM, code }] },
    owner: { reference: input.ownerReference ?? DEMO_V1.practitionerRoleReference },
    restriction: { period: { start: input.dueStart, end: input.dueEnd } },
  };
}

export function buildExceptionTask(input: OwnedDueTaskInput & { category: string }): Task {
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(input.category)) {
    throw new Error('Exception Task requires a valid category');
  }
  return taskBase(input, input.category);
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
  return buildExceptionTask({ ...input, category: 'resolve-uncertain-identity' });
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
