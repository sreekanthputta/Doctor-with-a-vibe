import type { Identifier, Resource } from '@medplum/fhirtypes';

export type ReadyVisitResourceType =
  | 'Patient'
  | 'Coverage'
  | 'QuestionnaireResponse'
  | 'Task'
  | 'CommunicationRequest'
  | 'Communication'
  | 'CoverageEligibilityRequest'
  | 'CoverageEligibilityResponse'
  | 'Appointment'
  | 'Provenance';

const READY_VISIT_ALLOWLIST: ReadonlySet<string> = new Set<ReadyVisitResourceType>([
  'Patient', 'Coverage', 'QuestionnaireResponse', 'Task', 'CommunicationRequest', 'Communication',
  'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'Appointment', 'Provenance',
]);

export interface MutationPlan<T extends Resource = Resource> {
  workflow: 'ready-visit';
  operation: 'create' | 'update';
  resource: T;
  idempotencyKey: string;
  expectedVersion?: string;
}

export function buildMutationPlan<T extends Resource>(input: MutationPlan<T>): MutationPlan<T> {
  if (!READY_VISIT_ALLOWLIST.has(input.resource.resourceType)) {
    throw new Error(`Resource type ${input.resource.resourceType} is not allowed for ready-visit`);
  }
  if (!input.idempotencyKey) {
    throw new Error('Mutation requires an idempotency key');
  }
  if (input.operation === 'update' && !input.expectedVersion) {
    throw new Error('Update requires an expected version');
  }
  if (input.operation === 'update' && (!input.resource.id || !input.resource.meta?.versionId)) {
    throw new Error('Update requires a versioned resource');
  }
  if (input.operation === 'update' && input.resource.meta?.versionId !== input.expectedVersion) {
    throw new Error('Expected version does not match the resource version');
  }
  return input;
}

export interface FhirRepository {
  conditionalCreate<T extends Resource>(resource: T, ifNoneExist: string): Promise<{ created: boolean; resource: T }>;
  create<T extends Resource>(plan: MutationPlan<T>): Promise<T>;
  update<T extends Resource>(plan: MutationPlan<T>): Promise<T>;
  read<T extends Resource>(reference: string): Promise<T | undefined>;
  searchByIdentifier<T extends Resource>(resourceType: T['resourceType'], identifier: Identifier): Promise<T[]>;
}

export async function reconcileMutation<T extends Resource>(input: {
  businessIdentifier: Identifier;
  search: (identifier: Identifier) => Promise<T[]>;
}): Promise<
  | { state: 'not-found'; retryMutation: true }
  | { state: 'committed'; retryMutation: false; resource: T }
  | { state: 'blocked'; retryMutation: false; reason: 'ambiguous-identifier' }
> {
  const found = await input.search(input.businessIdentifier);
  if (found.length === 0) return { state: 'not-found', retryMutation: true };
  if (found.length > 1) return { state: 'blocked', retryMutation: false, reason: 'ambiguous-identifier' };
  return { state: 'committed', retryMutation: false, resource: found[0] };
}
