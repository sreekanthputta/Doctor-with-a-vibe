import { z } from 'zod';

export const ReadyVisitVMSchema = z.object({
  appointmentBusinessId: z.string().min(1),
  patientDisplay: z.string().min(1),
  physicianDisplay: z.string().min(1),
  startsAt: z.iso.datetime({ offset: true }),
  status: z.enum(['needs-attention', 'ready']),
  openRequiredTaskCount: z.number().int().nonnegative(),
  eligibilityTransaction: z.enum(['not-run', 'in-progress', 'completed', 'failed']),
  sourceUpdatedAt: z.iso.datetime({ offset: true }),
  provenanceState: z.enum(['confirmed', 'reconciling', 'blocked']),
}).strict().superRefine((value, context) => {
  if (value.status === 'ready' && (value.openRequiredTaskCount !== 0 || value.eligibilityTransaction !== 'completed')) {
    context.addIssue({ code: 'custom', message: 'Ready requires completed eligibility and no open required tasks' });
  }
});

export type ReadyVisitVM = z.infer<typeof ReadyVisitVMSchema>;
