import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import { assessIntakeCompleteness } from '../intake-completeness';

const availableAnswers = {
  'contact-email': 'maria@example.test',
  'contact-phone': '3125550100',
  'coverage-payer-name': 'Aetna',
  'administrative-communication-consent': true,
};

describe('intake completeness', () => {
  it('stays in progress and identifies only the missing member ID', () => {
    expect(assessIntakeCompleteness(availableAnswers)).toEqual({
      status: 'in-progress',
      missingLinkIds: ['coverage-member-id'],
    });
  });

  it('completes only when every required typed answer is valid', () => {
    expect(assessIntakeCompleteness({
      ...availableAnswers,
      'coverage-member-id': DEMO_V1.memberId,
    })).toEqual({ status: 'completed', missingLinkIds: [] });
  });

  it('treats missing consent and wrong answer types as incomplete', () => {
    expect(assessIntakeCompleteness({ ...availableAnswers, 'administrative-communication-consent': 'yes' }))
      .toEqual({ status: 'in-progress', missingLinkIds: ['administrative-communication-consent', 'coverage-member-id'] });
  });
});
