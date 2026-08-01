import { describe, expect, it } from 'vitest';
import { transitionRequiredTask } from '../task-lifecycle';

describe('required Task lifecycle', () => {
  it('allows only a human owner to acknowledge requested -> accepted', () => {
    expect(transitionRequiredTask('requested', 'acknowledge', 'human-owner')).toBe('accepted');
    expect(() => transitionRequiredTask('requested', 'acknowledge', 'automation')).toThrow('human-owner-required');
  });

  it('allows the published administrative rule to complete only after ordered evidence persists', () => {
    expect(transitionRequiredTask('requested', 'resolve-member-id', 'automation', {
      coverageUpdated: true,
      eligibilityRequestPersisted: true,
      eligibilityResponsePersisted: true,
      questionnaireCompleted: true,
    })).toBe('completed');
  });

  it('refuses completion when eligibility or intake evidence is incomplete', () => {
    expect(() => transitionRequiredTask('requested', 'resolve-member-id', 'automation', {
      coverageUpdated: true,
      eligibilityRequestPersisted: true,
      eligibilityResponsePersisted: false,
      questionnaireCompleted: true,
    })).toThrow('member-resolution-evidence-incomplete');
  });
});
