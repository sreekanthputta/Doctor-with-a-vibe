import type { HealthcareService, Organization, Practitioner, PractitionerRole, Resource, Schedule, Slot } from '@medplum/fhirtypes';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import { buildAdultWellnessQuestionnaire } from '../../fhir/questionnaire';
import { demoIdentifier } from '../../fhir/identifiers';

const practitionerId = 'maya';
const practitionerRoleId = 'maya-role';
const serviceId = 'adult-primary-care';
const scheduleId = 'maya-adult-primary-care';
const payerId = 'aetna-demo';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

const baselineResources: Resource[] = [
  { resourceType: 'Organization', id: payerId, identifier: [demoIdentifier('organization', payerId)], active: true, name: 'Aetna (synthetic demo)' } satisfies Organization,
  { resourceType: 'Practitioner', id: practitionerId, identifier: [demoIdentifier('practitioner', practitionerId)], active: true, name: [{ text: DEMO_V1.physician.display }] } satisfies Practitioner,
  { resourceType: 'PractitionerRole', id: practitionerRoleId, identifier: [demoIdentifier('practitioner-role', practitionerRoleId)], active: true, practitioner: { reference: `Practitioner/${practitionerId}` } } satisfies PractitionerRole,
  { resourceType: 'HealthcareService', id: serviceId, identifier: [demoIdentifier('healthcare-service', serviceId)], active: true, name: 'Adult primary care' } satisfies HealthcareService,
  { resourceType: 'Schedule', id: scheduleId, identifier: [demoIdentifier('schedule', scheduleId)], active: true, actor: [{ reference: DEMO_V1.practitionerRoleReference }, { reference: `HealthcareService/${serviceId}` }] } satisfies Schedule,
  ...DEMO_V1.offeredSlots.map((start, index): Slot => ({
    resourceType: 'Slot',
    id: `slot-${index + 1}`,
    identifier: [demoIdentifier('slot', `adult-wellness-${index + 1}`)],
    schedule: { reference: `Schedule/${scheduleId}` },
    status: 'free',
    start,
    end: new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString(),
  })),
  buildAdultWellnessQuestionnaire(),
];

export const BASELINE_SEED_MANIFEST: Readonly<{
  namespace: 'demo-v1';
  resources: readonly Resource[];
}> = Object.freeze({
  namespace: 'demo-v1',
  resources: deepFreeze(baselineResources),
});

const ALLOWED_RESET_TYPES = new Set([
  'Patient', 'Appointment', 'Coverage', 'QuestionnaireResponse', 'Task', 'CommunicationRequest',
  'Communication', 'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'Provenance',
]);

export interface ServerOwnedRunManifest {
  readonly namespace: 'demo-v1';
  readonly runId: string;
}

const recordedRunReferences = new WeakMap<ServerOwnedRunManifest, string[]>();
const baselineReferences = new Set(
  BASELINE_SEED_MANIFEST.resources.flatMap((resource) => resource.id ? [`${resource.resourceType}/${resource.id}`] : []),
);

export function createServerOwnedRunManifest(input: {
  namespace: string;
  runId: string;
}): ServerOwnedRunManifest {
  if (input.namespace !== BASELINE_SEED_MANIFEST.namespace || !/^[A-Za-z0-9.-]+$/.test(input.runId)) {
    throw new Error('Run manifest requires the synthetic namespace and a valid run ID');
  }
  const manifest: ServerOwnedRunManifest = Object.freeze({ namespace: 'demo-v1', runId: input.runId });
  recordedRunReferences.set(manifest, []);
  return manifest;
}

export function recordCreatedRunResource(manifest: ServerOwnedRunManifest, resource: Resource): void {
  const references = recordedRunReferences.get(manifest);
  if (!references) throw new Error('Reset manifest must be server-owned');
  if (!resource.id) throw new Error('Run resource must have a persisted ID');
  const reference = `${resource.resourceType}/${resource.id}`;
  if (baselineReferences.has(reference)) throw new Error('Reset cannot record a baseline resource');
  if (!ALLOWED_RESET_TYPES.has(resource.resourceType)) {
    throw new Error('Reset contains a resource type outside the workflow allowlist');
  }
  const identifiers = 'identifier' in resource && Array.isArray(resource.identifier) ? resource.identifier : [];
  const namespaced = identifiers.some((identifier) => identifier.system === DEMO_V1.identifierSystem
    && identifier.value?.startsWith(DEMO_V1.identifierPrefix));
  if (!namespaced) throw new Error('Reset can record only a namespaced run resource');
  if (!references.includes(reference)) references.push(reference);
}

export function planNamespacedReset(input: {
  developmentAdmin: boolean;
  manifest: ServerOwnedRunManifest;
}): { namespace: string; references: string[]; allowBroadDelete: false } {
  if (!input.developmentAdmin) {
    throw new Error('Reset requires explicit development/admin context');
  }
  const references = recordedRunReferences.get(input.manifest);
  if (!references) throw new Error('Reset manifest must be server-owned');
  return { namespace: input.manifest.namespace, references: [...references], allowBroadDelete: false };
}
