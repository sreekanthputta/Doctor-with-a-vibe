import type { AdministrativeIntent, IdentityDecision } from '../contracts';
import { DEMO_V1 } from '../test/fixtures/demo-v1';

type IdentitySubmission = Extract<AdministrativeIntent, { kind: 'identity-submission' }>;

export interface IdentityCandidate {
  patientBusinessId: string;
  patientRef: string;
}

export type ConditionalCreateResult =
  | { kind: 'created'; patientRef: string }
  | { kind: 'conflict'; rereadCandidates: readonly IdentityCandidate[] };

const PATIENT_BUSINESS_ID = `${DEMO_V1.identifierPrefix}patient:maria`;
const UNCERTAIN: IdentityDecision = {
  outcome: 'uncertain',
  exceptionCommandId: `${DEMO_V1.identifierPrefix}identity-exception:maria-demo`,
};

function isExactMaria(submission: IdentitySubmission): boolean {
  return submission.givenName.trim().toLocaleLowerCase('en-US') === DEMO_V1.patient.givenName.toLocaleLowerCase('en-US')
    && submission.familyName.trim().toLocaleLowerCase('en-US') === DEMO_V1.patient.familyName.toLocaleLowerCase('en-US')
    && submission.birthDate === DEMO_V1.patient.birthDate
    && submission.postalCode.trim() === DEMO_V1.patient.postalCode;
}

export function decideDemoIdentity(
  submission: IdentitySubmission,
  candidates: readonly IdentityCandidate[],
): IdentityDecision {
  if (!isExactMaria(submission)) return UNCERTAIN;
  if (candidates.length === 0) {
    return { outcome: 'verified-new-demo', patientBusinessId: PATIENT_BUSINESS_ID };
  }
  if (candidates.length === 1 && candidates[0]?.patientBusinessId === PATIENT_BUSINESS_ID) {
    return { outcome: 'exact-existing-demo', patientBusinessId: PATIENT_BUSINESS_ID };
  }
  return UNCERTAIN;
}

export function resolveConditionalCreate(
  submission: IdentitySubmission,
  result: ConditionalCreateResult,
): IdentityDecision {
  if (!isExactMaria(submission)) return UNCERTAIN;
  if (result.kind === 'created') {
    return { outcome: 'verified-new-demo', patientBusinessId: PATIENT_BUSINESS_ID };
  }
  const decision = decideDemoIdentity(submission, result.rereadCandidates);
  return decision.outcome === 'exact-existing-demo' ? decision : UNCERTAIN;
}
