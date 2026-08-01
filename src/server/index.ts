import express from 'express';
import { config } from 'dotenv';
import path from 'node:path';
import process from 'node:process';
import { parseServerEnv } from './env.js';

if (process.env.NODE_ENV !== 'production') config({ path: ['.env.local', '.env'], quiet: true });

const app = express();
const environment = parseServerEnv(process.env);
const port = environment.port;
const distPath = path.resolve(process.cwd(), 'dist');

app.disable('x-powered-by');
app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok', service: 'vibedoc' });
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
