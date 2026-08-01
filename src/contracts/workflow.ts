import { z } from 'zod';

export const WorkflowStateSchema = z.enum([
  'new',
  'identity-verified',
  'scheduled',
  'needs-attention',
  'eligibility-in-progress',
  'ready',
  'stopped',
]);

export const EligibilityTransactionStateSchema = z.enum(['not-run', 'in-progress', 'completed', 'failed']);
export const BenefitFieldStateSchema = z.enum(['returned', 'not-returned', 'not-checked', 'stale']);

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;
