import { AdministrativeIntentSchema, type AdministrativeIntent } from '../contracts';
import { createStopOutcome, FIXED_SAFETY_COPY, type StopOutcome } from './exception-policy';

export const DEMO_SAFETY_COPY = FIXED_SAFETY_COPY;

export type AdministrativeInputDecision =
  | { action: 'continue'; intent: AdministrativeIntent }
  | StopOutcome;

function containsAuthorityBearingField(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) return false;
  return Object.keys(input).some((key) => [
    'patientBusinessId',
    'patientRef',
    'role',
    'sessionId',
    'actor',
  ].includes(key));
}

/**
 * Accepts only the already-structured administrative union. Free-form language is never
 * interpreted here: the provider adapter must first produce a schema-valid proposal.
 */
export function evaluateAdministrativeInput(
  input: unknown,
  context: { workflowRunId: string } = { workflowRunId: 'unbound' },
): AdministrativeInputDecision {
  const parsed = AdministrativeIntentSchema.safeParse(input);
  if (parsed.success) return { action: 'continue', intent: parsed.data };

  return createStopOutcome(
    containsAuthorityBearingField(input) ? 'privacy' : 'clinical-language',
    context.workflowRunId,
  );
}
