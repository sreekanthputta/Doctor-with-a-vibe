import { z } from 'zod';

export const TraceStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'blocked', 'reconciling']);

export const TracePresentationSchema = z.object({
  traceId: z.string().min(1),
  messageId: z.string().min(1),
  toolName: z.string().min(1),
  status: TraceStatusSchema,
  startedAt: z.iso.datetime({ offset: true }).optional(),
  completedAt: z.iso.datetime({ offset: true }).optional(),
  safeInput: z.record(z.string(), z.unknown()).optional(),
  safeOutput: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type TracePresentation = z.infer<typeof TracePresentationSchema>;
