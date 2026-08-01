import { randomBytes, randomUUID } from 'node:crypto';
import type { SessionContext } from '../contracts/session.js';

type Role = SessionContext['role'];
type Persona = SessionContext['persona'];

type StoredSession = SessionContext & {
  voiceCapabilityId?: string;
  voiceDisclosureVersion?: string;
};

export class SessionStore {
  readonly #sessions = new Map<string, StoredSession>();

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly ttlMs = 30 * 60 * 1000,
  ) {}

  issue(role: Role, persona: Persona): SessionContext {
    const session: StoredSession = {
      sessionId: randomUUID(),
      role,
      persona,
      csrfToken: randomBytes(24).toString('base64url'),
      expiresAt: new Date(this.now().getTime() + this.ttlMs).toISOString(),
      voiceCapability: 'absent',
    };
    this.#sessions.set(session.sessionId, session);
    return this.#publicSession(session);
  }

  replace(sessionId: string, role: Role, persona: Persona): SessionContext {
    this.#sessions.delete(sessionId);
    return this.issue(role, persona);
  }

  get(sessionId: string): SessionContext | undefined {
    const session = this.#active(sessionId);
    return session ? this.#publicSession(session) : undefined;
  }

  authorizeMutation(sessionId: string, csrfToken: string, requiredRole: Role): boolean {
    const session = this.#active(sessionId);
    return session?.csrfToken === csrfToken && session.role === requiredRole;
  }

  grantVoice(sessionId: string, disclosureVersion: string): { capabilityId: string } {
    const session = this.#requireActive(sessionId);
    const capabilityId = randomUUID();
    session.voiceCapability = 'active';
    session.voiceCapabilityId = capabilityId;
    session.voiceDisclosureVersion = disclosureVersion;
    return { capabilityId };
  }

  revokeVoice(sessionId: string): void {
    const session = this.#requireActive(sessionId);
    session.voiceCapability = 'revoked';
    delete session.voiceCapabilityId;
    delete session.voiceDisclosureVersion;
  }

  canIssueVoiceToken(sessionId: string, capabilityId: string): boolean {
    const session = this.#active(sessionId);
    return session?.voiceCapability === 'active' && session.voiceCapabilityId === capabilityId;
  }

  acceptVoiceEvent(sessionId: string, capabilityId: string): boolean {
    return this.canIssueVoiceToken(sessionId, capabilityId);
  }

  #active(sessionId: string): StoredSession | undefined {
    const session = this.#sessions.get(sessionId);
    if (!session) return undefined;
    if (Date.parse(session.expiresAt) <= this.now().getTime()) {
      this.#sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  #requireActive(sessionId: string): StoredSession {
    const session = this.#active(sessionId);
    if (!session) throw new Error('Session is missing or expired');
    return session;
  }

  #publicSession(session: StoredSession): SessionContext {
    return {
      sessionId: session.sessionId,
      role: session.role,
      persona: session.persona,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      voiceCapability: session.voiceCapability,
    };
  }
}
