import type { DomainCommand } from '../contracts';
import { DEMO_V1 } from '../test/fixtures/demo-v1';

export const FIXED_SAFETY_COPY = 'VibeDoc cannot assess symptoms or emergencies. Do not wait for a reply. If you may be experiencing an emergency, call 911 or your local emergency number now. For other clinical concerns, contact a qualified healthcare professional.';
export const NEUTRAL_STOP_COPY = 'VibeDoc could not complete that administrative request. Please rephrase it or use the demo controls.';

export type StopCategory =
  | 'identity'
  | 'clinical-language'
  | 'mixed-clinical-administrative'
  | 'administrative-unmatched'
  | 'privacy'
  | 'provider-failure';

export interface StopOutcome {
  action: 'stop';
  category: StopCategory;
  safeCopy: string;
  exceptionCommand: DomainCommand;
}

export function createStopOutcome(category: StopCategory, workflowRunId: string): StopOutcome {
  const idempotencyKey = `demo-v1:exception:${category}:${workflowRunId}`;
  const requiresClinicalSafetyCopy = category === 'clinical-language'
    || category === 'mixed-clinical-administrative';
  return {
    action: 'stop',
    category,
    safeCopy: requiresClinicalSafetyCopy ? FIXED_SAFETY_COPY : NEUTRAL_STOP_COPY,
    exceptionCommand: {
      commandId: idempotencyKey,
      workflowRunId,
      idempotencyKey,
      type: 'create-exception',
      payload: {
        category,
        status: 'requested',
        ownerQueue: DEMO_V1.practitionerRoleReference,
        duePolicy: 'demo-v1:exception-due-4h',
        safeSessionLabel: `session-${workflowRunId}`,
      },
    },
  };
}
