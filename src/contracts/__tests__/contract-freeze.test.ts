import { describe, expect, it } from 'vitest';
import {
  AdministrativeIntentSchema,
  IdentityDecisionSchema,
  ReadyVisitVMSchema,
  SessionContextSchema,
  TracePresentationSchema,
} from '..';

describe('Gate 0A contract freeze', () => {
  it('accepts a closed annual-wellness request and rejects clinical free text', () => {
    expect(AdministrativeIntentSchema.safeParse({ kind: 'annual-wellness-request', timeOfDay: 'morning' }).success).toBe(true);
    expect(AdministrativeIntentSchema.safeParse({ kind: 'clinical-question', text: 'Should I take a medicine?' }).success).toBe(false);
  });

  it('does not attach a patient identifier to uncertain identity', () => {
    expect(IdentityDecisionSchema.safeParse({ outcome: 'uncertain', exceptionCommandId: 'command-1' }).success).toBe(true);
    expect(IdentityDecisionSchema.safeParse({ outcome: 'uncertain', exceptionCommandId: 'command-1', patientBusinessId: 'forged' }).success).toBe(false);
  });

  it('rejects Ready when eligibility is incomplete or a required task is open', () => {
    const base = {
      appointmentBusinessId: 'demo-v1:appointment:maria',
      patientDisplay: 'Maria Lopez',
      physicianDisplay: 'Dr. Maya Chen',
      startsAt: '2026-08-04T10:30:00-05:00',
      sourceUpdatedAt: '2026-08-01T15:00:00-05:00',
      provenanceState: 'confirmed',
    };
    expect(ReadyVisitVMSchema.safeParse({ ...base, status: 'ready', openRequiredTaskCount: 1, eligibilityTransaction: 'completed' }).success).toBe(false);
    expect(ReadyVisitVMSchema.safeParse({ ...base, status: 'ready', openRequiredTaskCount: 0, eligibilityTransaction: 'completed' }).success).toBe(true);
  });

  it('keeps role and voice capability explicit', () => {
    expect(SessionContextSchema.safeParse({
      sessionId: 'session-1',
      role: 'patient-demo',
      persona: 'maria-demo',
      csrfToken: 'csrf-token-at-least-16',
      expiresAt: '2026-08-01T16:00:00-05:00',
      voiceCapability: 'revoked',
    }).success).toBe(true);
    expect(SessionContextSchema.safeParse({
      sessionId: 'session-demo',
      role: 'demo-access',
      persona: 'anonymous',
      csrfToken: 'csrf-token-at-least-16',
      expiresAt: '2026-08-01T16:00:00-05:00',
      voiceCapability: 'absent',
    }).success).toBe(true);
  });

  it('allows only sanitized trace projections', () => {
    expect(TracePresentationSchema.safeParse({
      traceId: 'trace-1',
      messageId: 'message-1',
      toolName: 'book_appointment',
      status: 'running',
      safeInput: { slot: '10:30' },
      rawProviderPayload: { authorization: 'secret' },
    }).success).toBe(false);
  });
});
