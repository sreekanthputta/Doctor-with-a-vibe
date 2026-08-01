import { describe, expect, it } from 'vitest';
import { deriveReadiness } from '../readiness';

const complete = {
  bookingCurrent: true,
  requiredFieldsComplete: true,
  openRequiredTaskCount: 0,
  eligibility: {
    state: 'completed' as const,
    requestPersisted: true,
    responsePersisted: true,
    linked: true,
    sourceIdentifierValid: true,
    outcomeAccepted: true,
  },
};

describe('readiness derivation', () => {
  it('marks a visit Ready only with current booking, complete fields, linked evidence, and no open required Task', () => {
    expect(deriveReadiness(complete)).toEqual({ status: 'ready', blockers: [] });
  });

  it.each([
    ['booking-not-current', { bookingCurrent: false }],
    ['required-fields-incomplete', { requiredFieldsComplete: false }],
    ['open-required-task', { openRequiredTaskCount: 1 }],
    ['eligibility-not-completed', { eligibility: { ...complete.eligibility, state: 'failed' as const } }],
    ['eligibility-evidence-incomplete', { eligibility: { ...complete.eligibility, responsePersisted: false } }],
    ['eligibility-evidence-unlinked', { eligibility: { ...complete.eligibility, linked: false } }],
  ])('keeps Needs attention for %s', (blocker, patch) => {
    const input = { ...complete, ...patch };
    const result = deriveReadiness(input);
    expect(result.status).toBe('needs-attention');
    expect(result.blockers).toContain(blocker);
  });

  it('does not require every individual payer benefit field to be returned', () => {
    expect(deriveReadiness({ ...complete, benefitFields: ['not-returned', 'not-checked'] })).toEqual({
      status: 'ready',
      blockers: [],
    });
  });
});
