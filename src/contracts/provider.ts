import { z } from 'zod';
import { AdministrativeIntentSchema } from './administrative-intent';

export const ConversationAdapterResultSchema = z.object({
  intent: AdministrativeIntentSchema,
  provider: z.enum(['scripted', 'deepgram']),
  providerRequestId: z.string().optional(),
}).strict();

export const EligibilityAdapterResultSchema = z.object({
  outcome: z.enum(['complete', 'error']),
  source: z.enum(['fixture', 'stedi-test']),
  transactionId: z.string().min(1),
  active: z.boolean().optional(),
  copay: z.number().nonnegative().optional(),
}).strict();

export type ConversationAdapterResult = z.infer<typeof ConversationAdapterResultSchema>;
export type EligibilityAdapterResult = z.infer<typeof EligibilityAdapterResultSchema>;
