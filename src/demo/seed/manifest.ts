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
  { resourceType: 'Schedule', id: scheduleId, identifier: [demoIdentifier('schedule', scheduleId)], active: true, actor: [{ reference: `Practitioner/${practitionerId}` }, { reference: `HealthcareService/${serviceId}` }] } satisfies Schedule,
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
  'Patient', 'Appointment', 'Slot', 'Coverage', 'QuestionnaireResponse', 'Task', 'CommunicationRequest',
  'Communication', 'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'Provenance',
]);

export function planNamespacedReset(input: {
  namespace: string;
  developmentAdmin: boolean;
  createdReferences: string[];
}): { namespace: string; references: string[]; allowBroadDelete: false } {
  if (!input.developmentAdmin) {
    throw new Error('Reset requires explicit development/admin context');
  }
  if (input.namespace !== BASELINE_SEED_MANIFEST.namespace) {
    throw new Error('Reset namespace is not the synthetic demo namespace');
  }
  const references = [...new Set(input.createdReferences)];
  if (references.some((reference) => !/^[A-Za-z]+\/[A-Za-z0-9.-]+$/.test(reference))) {
    throw new Error('Reset contains an invalid explicit reference');
  }
  if (references.some((reference) => !ALLOWED_RESET_TYPES.has(reference.split('/')[0] ?? ''))) {
    throw new Error('Reset contains a resource type outside the workflow allowlist');
  }
  return { namespace: input.namespace, references, allowBroadDelete: false };
}
