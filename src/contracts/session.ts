import { z } from 'zod';

export const SessionContextSchema = z.object({
  sessionId: z.string().min(1),
  role: z.enum(['public', 'demo-access', 'patient-demo', 'physician-demo']),
  persona: z.enum(['anonymous', 'maria-demo', 'maya-demo']),
  csrfToken: z.string().min(16),
  expiresAt: z.iso.datetime({ offset: true }),
  voiceCapability: z.enum(['absent', 'active', 'revoked']),
}).strict();

export type SessionContext = z.infer<typeof SessionContextSchema>;
