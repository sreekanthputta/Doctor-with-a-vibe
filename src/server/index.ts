import express from 'express';
import { config } from 'dotenv';
import path from 'node:path';
import process from 'node:process';
import { parseServerEnv } from './env.js';
import { DemoWorkflowStore } from './demo-workflow-store.js';

if (process.env.NODE_ENV !== 'production') config({ path: ['.env.local', '.env'], quiet: true });

const app = express();
const environment = parseServerEnv(process.env);
const port = environment.port;
const distPath = path.resolve(process.cwd(), 'dist');
const demoWorkflow = new DemoWorkflowStore();

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
  response.status(200).json(demoWorkflow.snapshot());
});
app.post('/api/demo/reset', (_request, response) => {
  response.status(200).json(demoWorkflow.reset());
});
app.post('/api/demo/request', async (request, response) => {
  const message = typeof request.body?.message === 'string' ? request.body.message : '';
  if (!message.trim()) return response.status(400).json({ error: 'A message is required' });
  const result = await demoWorkflow.submitRequest(message);
  return response.status(200).json(result);
});
app.post('/api/demo/member-id', async (request, response) => {
  const memberId = typeof request.body?.memberId === 'string' ? request.body.memberId : '';
  try {
    const result = await demoWorkflow.submitMemberId(memberId);
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
