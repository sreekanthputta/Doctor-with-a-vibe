import { z } from 'zod';

export const DomainCommandSchema = z.object({
  commandId: z.string().min(1),
  workflowRunId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  type: z.enum([
    'verify-demo-identity',
    'book-appointment',
    'save-intake',
    'create-missing-member-task',
    'update-coverage-member-id',
    'run-eligibility',
    'complete-task',
    'create-identity-exception',
  ]),
  payload: z.record(z.string(), z.unknown()),
}).strict();

export type DomainCommand = z.infer<typeof DomainCommandSchema>;
