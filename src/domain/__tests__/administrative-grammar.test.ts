import { describe, expect, it } from 'vitest';
import {
  DEMO_SAFETY_COPY,
  evaluateAdministrativeInput,
  evaluateAdministrativeText,
} from '../administrative-grammar';

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

  it('matches the complete allowed turn and preserves the original text', () => {
    const originalText = '  I need an annual wellness visit in the morning.  ';
    expect(evaluateAdministrativeText(originalText, { workflowRunId: 'run-text' })).toEqual({
      action: 'continue',
      originalText,
      intent: { kind: 'annual-wellness-request', timeOfDay: 'morning' },
    });
  });

  it.each([
    ['I need an annual welness vist', 'administrative-unmatched'],
    ['I do not want an annual wellness visit', 'administrative-unmatched'],
    ['I feel under the weather', 'clinical-language'],
    ['I have a rash', 'clinical-language'],
    ['I am dizzy', 'clinical-language'],
    ['I have dizziness', 'clinical-language'],
    ['I have nausea', 'clinical-language'],
    ['I am feeling off', 'clinical-language'],
    ['Book an annual wellness visit and check this rash', 'mixed-clinical-administrative'],
    ['I need an annual wellness visit in the morning and I feel off', 'mixed-clinical-administrative'],
  ] as const)('fails closed with a category-preserving exception: %s', (input, category) => {
    const result = evaluateAdministrativeText(input, { workflowRunId: 'run-1' });

    expect(result.action).toBe('stop');
    if (result.action !== 'stop') throw new Error('expected stop');
    expect(result.originalText).toBe(input);
    expect(result.category).toBe(category);
    expect(result.exceptionCommand.type).toBe('create-exception');
    expect(result.exceptionCommand.payload).toMatchObject({ category, status: 'requested' });
    expect(result.exceptionCommand.idempotencyKey).toBe(`demo-v1:exception:${category}:run-1`);
    expect(JSON.stringify(result)).not.toContain('book-appointment');
    if (category === 'clinical-language' || category === 'mixed-clinical-administrative') {
      expect(result.safeCopy).toBe(DEMO_SAFETY_COPY);
    } else {
      expect(result.safeCopy).not.toBe(DEMO_SAFETY_COPY);
    }
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
