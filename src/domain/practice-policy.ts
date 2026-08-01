import { DEMO_V1 } from '../test/fixtures/demo-v1';

export const DEMO_PRACTICE_POLICY = Object.freeze({
  version: 'demo-v1',
  allowedVisitType: DEMO_V1.visitType,
  offeredSlots: DEMO_V1.offeredSlots,
});

export type SlotPolicyDecision =
  | { allowed: true; slot: (typeof DEMO_V1.offeredSlots)[number] }
  | { allowed: false; reason: 'slot-not-allowed-by-demo-v1-policy' };

export function selectPolicySlot(slot: string): SlotPolicyDecision {
  const matched = DEMO_PRACTICE_POLICY.offeredSlots.find((offered) => offered === slot);
  return matched === undefined
    ? { allowed: false, reason: 'slot-not-allowed-by-demo-v1-policy' }
    : { allowed: true, slot: matched };
}
