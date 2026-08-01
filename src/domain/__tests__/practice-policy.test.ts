import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import { DEMO_PRACTICE_POLICY, selectPolicySlot } from '../practice-policy';

describe('versioned practice policy', () => {
  it('offers only the frozen morning slots and selects the 10:30 demo slot', () => {
    expect(DEMO_PRACTICE_POLICY.version).toBe('demo-v1');
    expect(DEMO_PRACTICE_POLICY.allowedVisitType).toBe(DEMO_V1.visitType);
    expect(DEMO_PRACTICE_POLICY.offeredSlots).toEqual(DEMO_V1.offeredSlots);
    expect(selectPolicySlot(DEMO_V1.selectedSlot)).toEqual({ allowed: true, slot: DEMO_V1.selectedSlot });
  });

  it('rejects a slot outside the published policy', () => {
    expect(selectPolicySlot('2026-08-04T12:00:00-05:00')).toEqual({
      allowed: false,
      reason: 'slot-not-allowed-by-demo-v1-policy',
    });
  });
});
