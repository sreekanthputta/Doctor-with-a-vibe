import { z } from 'zod';

export const IdentityDecisionSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('verified-new-demo'), patientBusinessId: z.string().min(1) }).strict(),
  z.object({ outcome: z.literal('exact-existing-demo'), patientBusinessId: z.string().min(1) }).strict(),
  z.object({ outcome: z.literal('uncertain'), exceptionCommandId: z.string().min(1) }).strict(),
]);

export type IdentityDecision = z.infer<typeof IdentityDecisionSchema>;
