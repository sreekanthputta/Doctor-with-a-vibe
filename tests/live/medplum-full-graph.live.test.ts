import { config } from 'dotenv';
import { ClientStorage, MedplumClient, MemoryStorage } from '@medplum/core';
import type {
  HealthcareService,
  Organization,
  Practitioner,
  PractitionerRole,
  Resource,
  Schedule,
  Slot,
} from '@medplum/fhirtypes';
import { describe, expect, it } from 'vitest';
import { MedplumDemoPersistence } from '../../src/adapters/medplum-demo-persistence';
import { DEMO_V1 } from '../../src/test/fixtures/demo-v1';

config({ path: '.env.local', quiet: true });

const runLive = process.env.RUN_LIVE_MEDPLUM_TESTS === 'true';

describe.skipIf(!runLive)('Medplum full synthetic demo graph live conformance', () => {
  it('writes, rereads, versions, links, and cleans the complete ready-visit graph', async () => {
    const clientId = process.env.MEDPLUM_CLIENT_ID;
    const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Live Medplum credentials are required');

    const client = new MedplumClient({
      baseUrl: process.env.MEDPLUM_BASE_URL ?? 'https://api.medplum.com',
      storage: new ClientStorage(new MemoryStorage()),
    });
    await client.startClientLogin(clientId, clientSecret);
    const runId = `live-${Date.now()}`;
    const support: Resource[] = [];
    let persistence: MedplumDemoPersistence | undefined;

    async function create<T extends Resource>(resource: T): Promise<T> {
      const persisted = await client.createResource(resource);
      support.push(persisted);
      return persisted;
    }

    try {
      const insurer = await create<Organization>({ resourceType: 'Organization', active: true, name: `Aetna synthetic ${runId}` });
      const practitioner = await create<Practitioner>({ resourceType: 'Practitioner', active: true, name: [{ text: 'Dr. Maya Chen (synthetic)' }] });
      const provider = await create<PractitionerRole>({
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: `Practitioner/${practitioner.id}` },
      });
      const service = await create<HealthcareService>({ resourceType: 'HealthcareService', active: true, name: `Adult primary care ${runId}` });
      const schedule = await create<Schedule>({
        resourceType: 'Schedule',
        active: true,
        actor: [{ reference: `PractitionerRole/${provider.id}` }, { reference: `HealthcareService/${service.id}` }],
      });
      const slot = await create<Slot>({
        resourceType: 'Slot',
        schedule: { reference: `Schedule/${schedule.id}` },
        status: 'free',
        start: DEMO_V1.selectedSlot,
        end: '2026-08-04T16:00:00.000Z',
      });

      persistence = MedplumDemoPersistence.fromClient(client, {
        runId,
        now: () => DEMO_V1.clock,
        seedReferences: {
          healthcareServiceReference: `HealthcareService/${service.id}`,
          slotReference: `Slot/${slot.id}`,
          insurerReference: `Organization/${insurer.id}`,
          providerReference: `PractitionerRole/${provider.id}`,
        },
      });
      const started = await persistence.start({
        givenName: DEMO_V1.patient.givenName,
        familyName: DEMO_V1.patient.familyName,
        birthDate: DEMO_V1.patient.birthDate,
        postalCode: DEMO_V1.patient.postalCode,
      });
      const ready = await persistence.complete(DEMO_V1.memberId);

      expect(started.phase).toBe('needs-attention');
      expect(ready.phase).toBe('ready');
      expect(ready.evidence.map((item) => item.resourceType)).toEqual(expect.arrayContaining([
        'Patient', 'Appointment', 'Coverage', 'QuestionnaireResponse', 'Task', 'CommunicationRequest',
        'Communication', 'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'Provenance',
      ]));
      expect(ready.evidence.every((item) => Boolean(item.version) && Boolean(item.reference))).toBe(true);

      const eligibilityResponse = ready.evidence.find((item) => item.resourceType === 'CoverageEligibilityResponse');
      const reread = eligibilityResponse ? await client.readReference({ reference: eligibilityResponse.reference }) : undefined;
      expect(reread?.resourceType).toBe('CoverageEligibilityResponse');
      expect(reread?.meta?.versionId).toBe(eligibilityResponse?.version);
    } finally {
      try {
        if (persistence) await persistence.reset();
      } finally {
        for (const resource of support.reverse()) {
          if (resource.id) await client.deleteResource(resource.resourceType, resource.id);
        }
      }
    }
  }, 60_000);
});
