import { z } from 'zod';

const voiceConsent = z.object({
  kind: z.literal('voice-processing'),
  decision: z.enum(['accept', 'decline', 'revoke']),
}).strict();

const identitySubmission = z.object({
  kind: z.literal('identity-submission'),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  birthDate: z.iso.date(),
  postalCode: z.string().min(3).max(12),
}).strict();

const appointmentRequest = z.object({
  kind: z.literal('annual-wellness-request'),
  preferredDate: z.iso.date().optional(),
  timeOfDay: z.enum(['morning', 'afternoon']).optional(),
}).strict();

const slotSelection = z.object({
  kind: z.literal('slot-selection'),
  slotBusinessId: z.string().min(1),
}).strict();

const memberIdSubmission = z.object({
  kind: z.literal('member-id-submission'),
  memberId: z.string().min(1),
}).strict();

export const AdministrativeIntentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('automation-disclosure-acknowledgment') }).strict(),
  voiceConsent,
  identitySubmission,
  appointmentRequest,
  slotSelection,
  z.object({ kind: z.literal('demographics-submission'), email: z.email(), phone: z.string().min(7) }).strict(),
  z.object({ kind: z.literal('coverage-submission'), payerName: z.string().min(1), memberId: z.string().optional() }).strict(),
  z.object({ kind: z.literal('intake-submission'), answers: z.record(z.string(), z.union([z.string(), z.boolean()])) }).strict(),
  memberIdSubmission,
  z.object({ kind: z.literal('administrative-faq'), topic: z.enum(['hours', 'location', 'visit-preparation', 'coverage-estimate']) }).strict(),
]);

export type AdministrativeIntent = z.infer<typeof AdministrativeIntentSchema>;
