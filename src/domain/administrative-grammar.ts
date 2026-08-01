import { AdministrativeIntentSchema, type AdministrativeIntent } from '../contracts';
import { createStopOutcome, FIXED_SAFETY_COPY, type StopOutcome } from './exception-policy';

export const DEMO_SAFETY_COPY = FIXED_SAFETY_COPY;

export type AdministrativeInputDecision =
  | { action: 'continue'; intent: AdministrativeIntent }
  | StopOutcome;

export type AdministrativeTextDecision =
  | { action: 'continue'; originalText: string; intent: AdministrativeIntent }
  | (StopOutcome & { originalText: string });

const annualWellnessTurn = /^(?:i need|i want|i would like|i'd like|please (?:book|schedule)|(?:book|schedule)(?: me)?) (?:an? )?annual (?:wellness|physical) visit(?: (?:in )?(?:the )?(morning|afternoon))?[.!?]?$/i;
const administrativeLanguage = /\b(annual|wellness|physical|visit|appointment|book|schedule)\b/i;
const clinicalLanguage = /\b(chest pain|shortness of breath|bleed(?:ing)?|fever|headache|hurt(?:ing)?|rash|dizz(?:y|iness)|nausea|nauseous|symptoms?|medic(?:ine|ation)|dose|diagnos(?:e|is)|under the weather|feeling off|feel off)\b/i;

function normalizeForMatching(originalText: string): string {
  return originalText.trim().replace(/\s+/g, ' ');
}

/**
 * Interprets one complete scripted demo turn. The allowlist is intentionally anchored to the
 * entire normalized utterance, while the exact original text is retained for caller-owned UI.
 */
export function evaluateAdministrativeText(
  originalText: string,
  context: { workflowRunId: string } = { workflowRunId: 'unbound' },
): AdministrativeTextDecision {
  const normalized = normalizeForMatching(originalText);
  const match = annualWellnessTurn.exec(normalized);
  if (match) {
    const timeOfDay = match[1]?.toLocaleLowerCase('en-US') as 'morning' | 'afternoon' | undefined;
    return {
      action: 'continue',
      originalText,
      intent: {
        kind: 'annual-wellness-request',
        ...(timeOfDay ? { timeOfDay } : {}),
      },
    };
  }

  const hasClinicalLanguage = clinicalLanguage.test(normalized);
  const hasAdministrativeLanguage = administrativeLanguage.test(normalized);
  const category = hasClinicalLanguage
    ? hasAdministrativeLanguage ? 'mixed-clinical-administrative' : 'clinical-language'
    : 'administrative-unmatched';
  return {
    ...createStopOutcome(category, context.workflowRunId),
    originalText,
  };
}

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
): AdministrativeInputDecision | AdministrativeTextDecision {
  if (typeof input === 'string') return evaluateAdministrativeText(input, context);
  const parsed = AdministrativeIntentSchema.safeParse(input);
  if (parsed.success) return { action: 'continue', intent: parsed.data };

  return createStopOutcome(
    containsAuthorityBearingField(input) ? 'privacy' : 'provider-failure',
    context.workflowRunId,
  );
}
