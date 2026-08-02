import { z } from 'zod';
import { ReadyVisitVMSchema } from '../contracts/ready-visit';
import type { DemoWorkflowSnapshot } from '../server/demo-workflow-store';

const DemoResourceEvidenceSchema = z.object({
  resourceType: z.string().min(1),
  reference: z.string().min(1),
  version: z.string().min(1),
  sourceUpdatedAt: z.iso.datetime({ offset: true }),
  workflowRole: z.string().min(1),
  sourceIdentifier: z.string().min(1).optional(),
}).strict();

const DemoExceptionSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['identity', 'clinical-language', 'mixed-clinical-administrative', 'administrative-unmatched', 'privacy', 'provider-failure']),
  status: z.enum(['requested', 'accepted']),
  ownerReference: z.string().min(1),
}).strict();

const DemoWorkflowSnapshotSchema = z.object({
  phase: z.enum(['empty', 'needs-attention', 'ready', 'stopped']),
  visit: ReadyVisitVMSchema.optional(),
  exceptions: DemoExceptionSchema.array(),
  resourceEvidence: DemoResourceEvidenceSchema.array(),
  stopCopy: z.string().optional(),
  identityVerified: z.boolean(),
  providerMode: z.enum(['fixture', 'live']),
}).strict().superRefine((snapshot, context) => {
  const visitRequired = snapshot.phase === 'ready' || snapshot.phase === 'needs-attention';
  if (visitRequired !== Boolean(snapshot.visit)) {
    context.addIssue({ code: 'custom', message: 'Snapshot phase and visit presence must align' });
  }
  if (snapshot.phase === 'ready' && snapshot.visit?.status !== 'ready') {
    context.addIssue({ code: 'custom', message: 'Ready snapshot requires a Ready visit' });
  }
  if (snapshot.phase === 'needs-attention' && snapshot.visit?.status !== 'needs-attention') {
    context.addIssue({ code: 'custom', message: 'Needs-attention snapshot requires a Needs-attention visit' });
  }
  if (snapshot.phase !== 'ready') return;

  const exactlyOne = [
    'Appointment',
    'Coverage',
    'QuestionnaireResponse',
    'Task',
    'CoverageEligibilityRequest',
    'CoverageEligibilityResponse',
  ];
  for (const resourceType of exactlyOne) {
    const count = snapshot.resourceEvidence.filter((item) => item.resourceType === resourceType).length;
    if (count !== 1) {
      context.addIssue({ code: 'custom', message: `Ready requires exactly one ${resourceType} evidence record` });
    }
  }
  if (!snapshot.resourceEvidence.some((item) => item.resourceType === 'Provenance')) {
    context.addIssue({ code: 'custom', message: 'Ready requires persisted Provenance evidence' });
  }
  const eligibilityResponse = snapshot.resourceEvidence.find(
    (item) => item.resourceType === 'CoverageEligibilityResponse',
  );
  if (!eligibilityResponse?.sourceIdentifier?.match(/^(fixture|stedi-test):.+/)) {
    context.addIssue({ code: 'custom', message: 'Ready requires a recognized eligibility source identifier' });
  }
});

export function parseDemoWorkflowSnapshot(payload: unknown): DemoWorkflowSnapshot {
  return DemoWorkflowSnapshotSchema.parse(payload);
}
