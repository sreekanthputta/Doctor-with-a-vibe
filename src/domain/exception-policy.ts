import type { DomainCommand } from '../contracts';

export const FIXED_SAFETY_COPY = 'VibeDoc cannot assess symptoms or emergencies. Do not wait for a reply. If you may be experiencing an emergency, call 911 or your local emergency number now. For other clinical concerns, contact a qualified healthcare professional.';

export type StopCategory = 'identity' | 'clinical-language' | 'privacy' | 'provider-failure';

export interface StopOutcome {
  action: 'stop';
  category: StopCategory;
  safeCopy: string;
  exceptionCommand: DomainCommand;
}

export function createStopOutcome(category: StopCategory, workflowRunId: string): StopOutcome {
  const idempotencyKey = `demo-v1:exception:${category}:${workflowRunId}`;
  return {
    action: 'stop',
    category,
    safeCopy: FIXED_SAFETY_COPY,
    exceptionCommand: {
      commandId: idempotencyKey,
      workflowRunId,
      idempotencyKey,
      type: 'create-identity-exception',
      payload: {
        category,
        status: 'requested',
        ownerQueue: 'PractitionerRole/maya-demo',
        duePolicy: 'demo-v1:exception-due-4h',
        safeSessionLabel: `session-${workflowRunId}`,
      },
    },
  };
}
