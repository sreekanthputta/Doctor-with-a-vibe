import { describe, expect, it } from 'vitest';
import { SessionStore } from '../../src/server/session-store';

const now = new Date('2026-08-01T20:00:00.000Z');

describe('SessionStore', () => {
  it('rotates trust-domain sessions and rejects the previous cookie', () => {
    const store = new SessionStore(() => now);
    const publicSession = store.issue('public', 'anonymous');
    const patientSession = store.replace(publicSession.sessionId, 'patient-demo', 'maria-demo');

    expect(store.get(publicSession.sessionId)).toBeUndefined();
    expect(store.get(patientSession.sessionId)?.role).toBe('patient-demo');
    expect(patientSession.sessionId).not.toBe(publicSession.sessionId);
  });

  it('requires matching CSRF for mutations', () => {
    const store = new SessionStore(() => now);
    const session = store.issue('physician-demo', 'maya-demo');

    expect(store.authorizeMutation(session.sessionId, session.csrfToken, 'physician-demo')).toBe(true);
    expect(store.authorizeMutation(session.sessionId, 'wrong-token', 'physician-demo')).toBe(false);
    expect(store.authorizeMutation(session.sessionId, session.csrfToken, 'patient-demo')).toBe(false);
  });

  it('revokes only voice authority and rejects late events while typing survives', () => {
    const store = new SessionStore(() => now);
    const session = store.issue('patient-demo', 'maria-demo');
    const voice = store.grantVoice(session.sessionId, 'voice-disclosure-v1');

    expect(store.canIssueVoiceToken(session.sessionId, voice.capabilityId)).toBe(true);
    store.revokeVoice(session.sessionId);
    expect(store.canIssueVoiceToken(session.sessionId, voice.capabilityId)).toBe(false);
    expect(store.acceptVoiceEvent(session.sessionId, voice.capabilityId)).toBe(false);
    expect(store.get(session.sessionId)?.role).toBe('patient-demo');
  });

  it('caps cookie-less session allocation', () => {
    const store = new SessionStore(() => now, 60_000, 2);
    store.issue('public', 'anonymous');
    store.issue('public', 'anonymous');
    expect(() => store.issue('public', 'anonymous')).toThrow(/capacity/i);
  });
});
