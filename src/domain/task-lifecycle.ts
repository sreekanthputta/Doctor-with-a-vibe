export type RequiredTaskStatus = 'requested' | 'accepted' | 'in-progress' | 'completed' | 'rejected' | 'failed';
export type TaskActor = 'automation' | 'human-owner';

export interface MemberResolutionEvidence {
  coverageUpdated: boolean;
  eligibilityRequestPersisted: boolean;
  eligibilityResponsePersisted: boolean;
  questionnaireCompleted: boolean;
}

export function transitionRequiredTask(
  current: RequiredTaskStatus,
  action: 'acknowledge' | 'start' | 'resolve-member-id',
  actor: TaskActor,
  evidence?: MemberResolutionEvidence,
): RequiredTaskStatus {
  if (action === 'acknowledge') {
    if (actor !== 'human-owner') throw new Error('human-owner-required');
    if (current !== 'requested') throw new Error('invalid-task-transition');
    return 'accepted';
  }
  if (action === 'start') {
    if (actor !== 'human-owner' || (current !== 'requested' && current !== 'accepted')) {
      throw new Error('invalid-task-transition');
    }
    return 'in-progress';
  }
  if (current !== 'requested' && current !== 'accepted' && current !== 'in-progress') {
    throw new Error('invalid-task-transition');
  }
  if (evidence === undefined || !Object.values(evidence).every(Boolean)) {
    throw new Error('member-resolution-evidence-incomplete');
  }
  return 'completed';
}
