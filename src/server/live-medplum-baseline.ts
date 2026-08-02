import type {
  HealthcareService,
  Organization,
  Practitioner,
  PractitionerRole,
  Questionnaire,
  Resource,
  Schedule,
  Slot,
} from '@medplum/fhirtypes';
import type { FhirRepository } from '../fhir/repository';
import { demoIdentifier } from '../fhir/identifiers';
import { buildAdultWellnessQuestionnaire } from '../fhir/questionnaire';
import { DEMO_V1 } from '../test/fixtures/demo-v1';

export type LiveMedplumBaselineReferences = {
  healthcareServiceReference: string;
  slotReference: string;
  insurerReference: string;
  providerReference: string;
};

const SCHEDULING_PARAMETERS_URL = 'https://medplum.com/fhir/StructureDefinition/SchedulingParameters';
const SERVICE_REFERENCE_URL = 'https://medplum.com/fhir/service-type-reference';
const TIMEZONE_URL = 'http://hl7.org/fhir/StructureDefinition/timezone';

function referenceOf(resource: Resource): string {
  if (!resource.id || !resource.meta?.versionId) throw new Error(`${resource.resourceType} baseline did not return a committed version`);
  return `${resource.resourceType}/${resource.id}`;
}

async function ensureOne<T extends Resource>(repository: FhirRepository, resource: T): Promise<T> {
  const identifier = 'identifier' in resource && Array.isArray(resource.identifier) ? resource.identifier[0] : undefined;
  if (!identifier?.system || !identifier.value) throw new Error(`${resource.resourceType} baseline requires an identifier`);
  const result = await repository.conditionalCreate(
    resource,
    `identifier=${encodeURIComponent(`${identifier.system}|${identifier.value}`)}`,
  );
  const matches = await repository.searchByIdentifier<T>(resource.resourceType, identifier);
  if (matches.length !== 1) throw new Error(`${resource.resourceType} baseline identifier must resolve uniquely`);
  const persisted = await repository.read<T>(referenceOf(matches[0]));
  if (!persisted || referenceOf(persisted) !== referenceOf(result.resource)) {
    throw new Error(`${resource.resourceType} conditional baseline result did not match the resolved resource`);
  }
  return persisted;
}

function serviceType(healthcareServiceReference: string) {
  return [{
    coding: [{ system: 'urn:vibedoc:service-type', code: DEMO_V1.visitType }],
    text: 'Adult annual wellness visit',
    extension: [{ url: SERVICE_REFERENCE_URL, valueReference: { reference: healthcareServiceReference } }],
  }];
}

/** Creates/reuses the synthetic hosted baseline in dependency order and returns actual server references. */
export async function ensureLiveMedplumBaseline(repository: FhirRepository): Promise<LiveMedplumBaselineReferences> {
  const clinic = await ensureOne<Organization>(repository, {
    resourceType: 'Organization', identifier: [demoIdentifier('organization', 'vibedoc-clinic')],
    active: true, name: 'VibeDoc Clinic (synthetic demo)',
  });
  const insurer = await ensureOne<Organization>(repository, {
    resourceType: 'Organization', identifier: [demoIdentifier('organization', 'aetna-demo')],
    active: true, name: 'Aetna (synthetic demo)',
  });
  const practitioner = await ensureOne<Practitioner>(repository, {
    resourceType: 'Practitioner', identifier: [demoIdentifier('practitioner', 'maya')],
    active: true, name: [{ text: DEMO_V1.physician.display }],
  });
  const provider = await ensureOne<PractitionerRole>(repository, {
    resourceType: 'PractitionerRole', identifier: [demoIdentifier('practitioner-role', 'maya-role')], active: true,
    practitioner: { reference: referenceOf(practitioner) },
    organization: { reference: referenceOf(clinic) },
    extension: [{ url: TIMEZONE_URL, valueCode: DEMO_V1.timezone }],
  });
  const service = await ensureOne<HealthcareService>(repository, {
    resourceType: 'HealthcareService', identifier: [demoIdentifier('healthcare-service', 'adult-primary-care')],
    active: true, providedBy: { reference: referenceOf(clinic) }, name: 'Adult primary care',
    type: [{ coding: [{ system: 'urn:vibedoc:service-type', code: DEMO_V1.visitType }], text: 'Adult annual wellness visit' }],
    extension: [{
      url: SCHEDULING_PARAMETERS_URL,
      extension: [
        { url: 'duration', valueDuration: { value: 30, unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' } },
        { url: 'alignmentInterval', valueDuration: { value: 30, unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' } },
        { url: 'alignmentTimezone', valueCode: DEMO_V1.timezone },
        { url: 'timezone', valueCode: DEMO_V1.timezone },
      ],
    }],
  });
  const serviceReference = referenceOf(service);
  const schedule = await ensureOne<Schedule>(repository, {
    resourceType: 'Schedule', identifier: [demoIdentifier('schedule', 'maya-adult-primary-care')], active: true,
    actor: [{ reference: referenceOf(provider) }],
    serviceType: serviceType(serviceReference),
    extension: [{
      url: SCHEDULING_PARAMETERS_URL,
      extension: [
        { url: 'service', valueReference: { reference: serviceReference } },
        { url: 'duration', valueDuration: { value: 30, unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' } },
        { url: 'timezone', valueCode: DEMO_V1.timezone },
      ],
    }],
  });
  const scheduleReference = referenceOf(schedule);
  const slots: Slot[] = [];
  for (const [index, start] of DEMO_V1.offeredSlots.entries()) {
    slots.push(await ensureOne<Slot>(repository, {
      resourceType: 'Slot', identifier: [demoIdentifier('slot', `adult-wellness-${index + 1}`)],
      schedule: { reference: scheduleReference }, status: 'free', start,
      end: new Date(Date.parse(start) + (30 * 60 * 1000)).toISOString(),
    }));
  }
  await ensureOne<Questionnaire>(repository, buildAdultWellnessQuestionnaire());
  const selectedSlot = slots[1];
  if (!selectedSlot) throw new Error('Live baseline requires the selected demo Slot');
  return {
    healthcareServiceReference: serviceReference,
    slotReference: referenceOf(selectedSlot),
    insurerReference: referenceOf(insurer),
    providerReference: referenceOf(provider),
  };
}
