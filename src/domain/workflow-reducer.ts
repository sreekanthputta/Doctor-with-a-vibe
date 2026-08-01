import type { WorkflowState } from '../contracts';
import { createStopOutcome, type StopCategory, type StopOutcome } from './exception-policy';
import { deriveReadiness } from './readiness';
import type { RequiredTaskStatus } from './task-lifecycle';

export interface DemoWorkflowState {
  workflowRunId: string;
  stage: WorkflowState;
  identityVerified: boolean;
  bookingCurrent: boolean;
  memberIdPresent: boolean;
  coverageUpdated: boolean;
  requiredFieldsComplete: boolean;
  requiredTaskStatus?: RequiredTaskStatus;
  eligibility: {
    state: 'not-run' | 'in-progress' | 'completed' | 'failed';
    requestPersisted: boolean;
    responsePersisted: boolean;
    linked: boolean;
    sourceIdentifierValid: boolean;
    outcomeAccepted: boolean;
  };
  exceptionCommand?: StopOutcome['exceptionCommand'];
}

export type WorkflowEvent =
  | { type: 'identity-verified' }
  | { type: 'appointment-booked' }
  | { type: 'intake-saved'; complete: boolean }
  | { type: 'member-id-supplied' }
  | { type: 'coverage-updated' }
  | { type: 'eligibility-started' }
  | { type: 'eligibility-persisted'; linked: boolean; sourceIdentifierValid: boolean; outcomeAccepted: boolean }
  | { type: 'intake-completed' }
  | { type: 'required-task-completed' }
  | { type: 'stopped'; category: StopCategory };

export function createWorkflowState(workflowRunId: string): DemoWorkflowState {
  return {
    workflowRunId,
    stage: 'new',
    identityVerified: false,
    bookingCurrent: false,
    memberIdPresent: false,
    coverageUpdated: false,
    requiredFieldsComplete: false,
    eligibility: {
      state: 'not-run',
      requestPersisted: false,
      responsePersisted: false,
      linked: false,
      sourceIdentifierValid: false,
      outcomeAccepted: false,
    },
  };
}

function deriveStage(state: DemoWorkflowState): DemoWorkflowState {
  if (state.stage === 'stopped') return state;
  const readiness = deriveReadiness({
    bookingCurrent: state.bookingCurrent,
    requiredFieldsComplete: state.requiredFieldsComplete,
    openRequiredTaskCount: state.requiredTaskStatus === undefined || state.requiredTaskStatus === 'completed' ? 0 : 1,
    eligibility: state.eligibility,
  });
  if (readiness.status === 'ready') return { ...state, stage: 'ready' };
  if (state.bookingCurrent && state.requiredTaskStatus !== undefined) return { ...state, stage: 'needs-attention' };
  return state;
}

export function reduceWorkflow(state: DemoWorkflowState, event: WorkflowEvent): DemoWorkflowState {
  if (state.stage === 'stopped') throw new Error('workflow-stopped');
  switch (event.type) {
    case 'identity-verified':
      return { ...state, identityVerified: true, stage: 'identity-verified' };
    case 'appointment-booked':
      if (!state.identityVerified) throw new Error('identity-required-before-booking');
      return { ...state, bookingCurrent: true, stage: 'scheduled' };
    case 'intake-saved':
      if (!state.bookingCurrent) throw new Error('booking-required-before-intake');
      return deriveStage({
        ...state,
        requiredFieldsComplete: event.complete,
        requiredTaskStatus: event.complete ? undefined : 'requested',
      });
    case 'member-id-supplied':
      if (state.requiredTaskStatus === undefined) throw new Error('no-required-task');
      return { ...state, memberIdPresent: true };
    case 'coverage-updated':
      if (!state.memberIdPresent) throw new Error('member-id-required-before-coverage');
      return { ...state, coverageUpdated: true };
    case 'eligibility-started':
      if (!state.memberIdPresent || !state.coverageUpdated) throw new Error('member-id-required-before-eligibility');
      return { ...state, stage: 'eligibility-in-progress', eligibility: { ...state.eligibility, state: 'in-progress' } };
    case 'eligibility-persisted': {
      if (state.eligibility.state !== 'in-progress') throw new Error('eligibility-not-started');
      const valid = event.linked && event.sourceIdentifierValid && event.outcomeAccepted;
      return deriveStage({
        ...state,
        eligibility: {
          state: valid ? 'completed' : 'failed',
          requestPersisted: true,
          responsePersisted: true,
          linked: event.linked,
          sourceIdentifierValid: event.sourceIdentifierValid,
          outcomeAccepted: event.outcomeAccepted,
        },
      });
    }
    case 'intake-completed':
      if (!state.memberIdPresent) throw new Error('member-id-required-before-intake-completion');
      return deriveStage({ ...state, requiredFieldsComplete: true });
    case 'required-task-completed': {
      if (!state.coverageUpdated || !state.requiredFieldsComplete || state.eligibility.state !== 'completed') {
        throw new Error('required-task-resolution-not-persisted');
      }
      return deriveStage({ ...state, requiredTaskStatus: 'completed' });
    }
    case 'stopped': {
      const outcome = createStopOutcome(event.category, state.workflowRunId);
      return { ...state, stage: 'stopped', exceptionCommand: outcome.exceptionCommand };
    }
  }
}
