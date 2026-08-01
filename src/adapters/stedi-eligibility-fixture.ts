import { EligibilityAdapterResultSchema, type EligibilityAdapterResult } from '../contracts/provider';
import { DEMO_V1 } from '../test/fixtures/demo-v1';

export class StediEligibilityFixture {
  check(input: { memberId: string }): Promise<EligibilityAdapterResult> {
    if (input.memberId !== DEMO_V1.memberId) return Promise.reject(new Error('A valid synthetic member ID is required'));
    return Promise.resolve(EligibilityAdapterResultSchema.parse({
      outcome: 'complete',
      source: 'fixture',
      transactionId: 'demo-v1:eligibility:maria',
      active: true,
      copay: 40,
    }));
  }
}
