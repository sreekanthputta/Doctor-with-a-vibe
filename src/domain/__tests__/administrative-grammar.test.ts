import { describe, expect, it } from 'vitest';
import { DEMO_SAFETY_COPY, evaluateAdministrativeInput } from '../administrative-grammar';

describe('closed administrative grammar', () => {
  it('accepts a schema-valid annual wellness intent', () => {
    expect(evaluateAdministrativeInput({
      kind: 'annual-wellness-request',
      preferredDate: '2026-08-04',
      timeOfDay: 'morning',
    })).toEqual({ action: 'continue', intent: {
      kind: 'annual-wellness-request',
      preferredDate: '2026-08-04',
      timeOfDay: 'morning',
    } });
  });

  it.each([
    'I need an annual welness vist',
    'I do not want an annual wellness visit',
    'I feel under the weather',
    'Book a wellness visit and tell me whether my chest pain is dangerous',
    'Can you squeeze me in and check this rash?',
  ])('fails closed for unmatched, misspelled, negated, clinical, or mixed free text: %s', (input) => {
    const result = evaluateAdministrativeInput(input, { workflowRunId: 'run-1' });

    expect(result.action).toBe('stop');
    if (result.action !== 'stop') throw new Error('expected stop');
    expect(result.category).toBe('clinical-language');
    expect(result.safeCopy).toBe(DEMO_SAFETY_COPY);
    expect(result.exceptionCommand.type).toBe('create-identity-exception');
    expect(result.exceptionCommand.idempotencyKey).toBe('demo-v1:exception:clinical-language:run-1');
  });

  it('rejects malformed structured output and extra authority-bearing fields', () => {
    const result = evaluateAdministrativeInput({
      kind: 'identity-submission',
      givenName: 'Maria',
      familyName: 'Lopez',
      birthDate: '1974-02-14',
      postalCode: '60601',
      patientBusinessId: 'forged',
    }, { workflowRunId: 'run-2' });

    expect(result.action).toBe('stop');
    expect(result).toMatchObject({ category: 'privacy' });
  });
});
