const requiredAnswers = {
  'contact-email': 'string',
  'contact-phone': 'string',
  'coverage-payer-name': 'string',
  'administrative-communication-consent': 'boolean',
  'coverage-member-id': 'string',
} as const;

type IntakeAnswer = string | boolean;

export function assessIntakeCompleteness(answers: Readonly<Record<string, IntakeAnswer>>): {
  status: 'in-progress' | 'completed';
  missingLinkIds: string[];
} {
  const missingLinkIds = Object.entries(requiredAnswers)
    .filter(([linkId, expectedType]) => {
      const value = answers[linkId];
      return typeof value !== expectedType || (typeof value === 'string' && value.trim().length === 0);
    })
    .map(([linkId]) => linkId)
    .sort((left, right) => {
      if (left === 'coverage-member-id') return 1;
      if (right === 'coverage-member-id') return -1;
      return left.localeCompare(right);
    });

  return {
    status: missingLinkIds.length === 0 ? 'completed' : 'in-progress',
    missingLinkIds,
  };
}
