import type { BenefitFieldStateSchema, EligibilityTransactionStateSchema } from '../contracts';
import type { z } from 'zod';

type EligibilityState = z.infer<typeof EligibilityTransactionStateSchema>;
type BenefitFieldState = z.infer<typeof BenefitFieldStateSchema>;

export interface ReadinessInput {
  bookingCurrent: boolean;
  requiredFieldsComplete: boolean;
  openRequiredTaskCount: number;
  eligibility: {
    state: EligibilityState;
    requestPersisted: boolean;
    responsePersisted: boolean;
    linked: boolean;
    sourceIdentifierValid: boolean;
    outcomeAccepted: boolean;
  };
  benefitFields?: readonly BenefitFieldState[];
}

export type ReadinessBlocker =
  | 'booking-not-current'
  | 'required-fields-incomplete'
  | 'open-required-task'
  | 'eligibility-not-completed'
  | 'eligibility-evidence-incomplete'
  | 'eligibility-evidence-unlinked'
  | 'eligibility-source-invalid'
  | 'eligibility-outcome-not-accepted';

export function deriveReadiness(input: ReadinessInput): {
  status: 'ready' | 'needs-attention';
  blockers: ReadinessBlocker[];
} {
  const blockers: ReadinessBlocker[] = [];
  if (!input.bookingCurrent) blockers.push('booking-not-current');
  if (!input.requiredFieldsComplete) blockers.push('required-fields-incomplete');
  if (input.openRequiredTaskCount > 0) blockers.push('open-required-task');
  if (input.eligibility.state !== 'completed') blockers.push('eligibility-not-completed');
  if (!input.eligibility.requestPersisted || !input.eligibility.responsePersisted) {
    blockers.push('eligibility-evidence-incomplete');
  }
  if (!input.eligibility.linked) blockers.push('eligibility-evidence-unlinked');
  if (!input.eligibility.sourceIdentifierValid) blockers.push('eligibility-source-invalid');
  if (!input.eligibility.outcomeAccepted) blockers.push('eligibility-outcome-not-accepted');
  return { status: blockers.length === 0 ? 'ready' : 'needs-attention', blockers };
}
