import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';

describe('DEMO_V1', () => {
  it('freezes the selected slot and administrative intake contract', () => {
    expect(DEMO_V1.selectedSlot).toBe('2026-08-04T10:30:00-05:00');
    expect(DEMO_V1.offeredSlots).toContain(DEMO_V1.selectedSlot);
    expect(DEMO_V1.questionnaire.linkIds).toContain('coverage-member-id');
  });

  it('contains synthetic fixture values only', () => {
    expect(DEMO_V1.identifierSystem).toBe('urn:vibedoc:demo');
    expect(DEMO_V1.patient.persona).toBe('maria-demo');
  });
});
