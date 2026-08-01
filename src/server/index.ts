import express, { type Request, type Response } from 'express';
import { config } from 'dotenv';
import path from 'node:path';
import process from 'node:process';
import { z } from 'zod';
import { parseServerEnv } from './env.js';
import { DemoWorkflowStore } from './demo-workflow-store.js';
import { SessionStore } from './session-store.js';
import type { SessionContext } from '../contracts/session.js';

if (process.env.NODE_ENV !== 'production') config({ path: ['.env.local', '.env'], quiet: true });

const app = express();
const environment = parseServerEnv(process.env);
const port = environment.port;
const distPath = path.resolve(process.cwd(), 'dist');
const demoWorkflow = new DemoWorkflowStore();
const sessions = new SessionStore();
const demoRequestSchema = z.object({ message: z.string().trim().min(1) }).strict();
const memberIdSchema = z.object({ memberId: z.string() }).strict();
const transitionSchema = z.object({ persona: z.enum(['maria-demo', 'maya-demo']) }).strict();
const sessionCookieName = '__Host-vibedoc_session';

function cookieSessionId(request: Request): string | undefined {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookieName}=`));
  return cookie ? decodeURIComponent(cookie.slice(sessionCookieName.length + 1)) : undefined;
}

function currentSession(request: Request): SessionContext | undefined {
  const sessionId = cookieSessionId(request);
  return sessionId ? sessions.get(sessionId) : undefined;
}

function setSessionCookie(response: Response, sessionId: string): void {
  response.setHeader('Set-Cookie', `${sessionCookieName}=${encodeURIComponent(sessionId)}; Secure; HttpOnly; SameSite=Lax; Path=/`);
}

function sameOrigin(request: Request): boolean {
  const origin = request.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === request.get('host');
  } catch {
    return false;
  }
}

function authorizeMutation(request: Request, role: SessionContext['role']): boolean {
  const sessionId = cookieSessionId(request);
  const csrf = request.get('x-csrf-token');
  return Boolean(sessionId && csrf && sameOrigin(request) && sessions.authorizeMutation(sessionId, csrf, role));
}

function bootstrapSession(request: Request, response: Response, role: 'public' | 'demo-access'): void {
  const existing = currentSession(request);
  if (existing && existing.role !== role) {
    response.status(403).json({ error: 'A separate demo context is required' });
    return;
  }
  const session = existing ?? sessions.issue(role, 'anonymous');
  if (!existing) setSessionCookie(response, session.sessionId);
  response.status(200).json(session);
}

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/api', (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok', service: 'vibedoc' });
});
app.get('/api/demo/state', (_request, response) => {
  const session = currentSession(_request);
  if (!session) return response.status(401).json({ error: 'A demo session is required' });
  return response.status(200).json(demoWorkflow.snapshot());
});
app.get('/api/session/public', (request, response) => {
  bootstrapSession(request, response, 'public');
});
app.get('/api/session/demo', (request, response) => {
  bootstrapSession(request, response, 'demo-access');
});
app.get('/api/session/current', (request, response) => {
  const session = currentSession(request);
  if (!session) return response.status(401).json({ error: 'A demo session is required' });
  return response.status(200).json(session);
});
app.post('/api/session/transition', (request, response) => {
  if (!authorizeMutation(request, 'demo-access')) return response.status(403).json({ error: 'Demo transition is not authorized' });
  const parsed = transitionSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Unknown synthetic persona' });
  const sessionId = cookieSessionId(request);
  if (!sessionId) return response.status(401).json({ error: 'Demo session is required' });
  const session = parsed.data.persona === 'maria-demo'
    ? sessions.replace(sessionId, 'patient-demo', 'maria-demo')
    : sessions.replace(sessionId, 'physician-demo', 'maya-demo');
  setSessionCookie(response, session.sessionId);
  return response.status(200).json(session);
});
app.post('/api/demo/reset', (request, response) => {
  if (environment.nodeEnv === 'production' || request.get('x-demo-reset-token') !== 'vibedoc-e2e-reset') {
    return response.status(404).json({ error: 'Not found' });
  }
  response.status(200).json(demoWorkflow.reset());
});
app.post('/api/demo/request', async (request, response) => {
  if (!authorizeMutation(request, 'public')) return response.status(403).json({ error: 'Public session is required' });
  const parsed = demoRequestSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'A message is required' });
  const result = await demoWorkflow.submitRequest(parsed.data.message);
  return response.status(200).json(result);
});
app.post('/api/demo/identity-replay', (request, response) => {
  if (!authorizeMutation(request, 'public')) return response.status(403).json({ error: 'Public session is required' });
  return response.status(200).json(demoWorkflow.submitUncertainIdentityReplay());
});
app.post('/api/demo/member-id', async (request, response) => {
  if (!authorizeMutation(request, 'patient-demo')) return response.status(403).json({ error: 'Patient demo session is required' });
  const parsed = memberIdSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'A member ID is required' });
  try {
    const result = await demoWorkflow.submitMemberId(parsed.data.memberId);
    return response.status(200).json(result);
  } catch {
    return response.status(400).json({ error: 'The synthetic member ID was not accepted' });
  }
});
app.use(express.static(distPath));
app.use((request, response, next) => {
  if (request.method !== 'GET' || !request.accepts('html')) return next();
  return response.sendFile(path.join(distPath, 'index.html'));
});

const server = app.listen(port, '0.0.0.0');

function shutdown(): void {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
