import { config } from 'dotenv';
import { ClientStorage, MedplumClient, MemoryStorage } from '@medplum/core';
import type { Patient, Resource } from '@medplum/fhirtypes';
import { describe, expect, it } from 'vitest';
import { MedplumDemoPersistence } from '../../src/adapters/medplum-demo-persistence';
import { MedplumFhirRepository } from '../../src/adapters/medplum-fhir-repository';
import { buildAppointmentDraft, MedplumAtomicSchedulingRepository, SlotConflict } from '../../src/fhir/scheduling';
import { ensureLiveMedplumBaseline } from '../../src/server/live-medplum-baseline';
import { DEMO_V1 } from '../../src/test/fixtures/demo-v1';

config({ path: '.env.local', quiet: true });

const runLive = process.env.RUN_LIVE_MEDPLUM_TESTS === 'true';

async function liveClient(): Promise<MedplumClient> {
  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Live Medplum credentials are required');
  const client = new MedplumClient({
    baseUrl: process.env.MEDPLUM_BASE_URL ?? 'https://api.medplum.com',
    storage: new ClientStorage(new MemoryStorage()),
  });
  await client.startClientLogin(clientId, clientSecret);
  return client;
}

describe.skipIf(!runLive)('Medplum full synthetic demo graph live conformance', () => {
  it('conditionally resolves the hosted baseline, atomically books, writes the ready graph, and cleans run resources', async () => {
    const client = await liveClient();
    const baseline = await ensureLiveMedplumBaseline(new MedplumFhirRepository(client));
    const runId = `live-${Date.now()}`;
    const persistence = MedplumDemoPersistence.fromClient(client, { runId, now: () => DEMO_V1.clock, seedReferences: baseline });

    try {
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
      const appointmentEvidence = ready.evidence.find((item) => item.resourceType === 'Appointment');
      const appointment = appointmentEvidence
        ? await client.readReference({ reference: appointmentEvidence.reference })
        : undefined;
      expect(appointment?.resourceType === 'Appointment' && appointment.status).toBe('booked');
      const slotReference = appointment?.resourceType === 'Appointment' ? appointment.slot?.[0]?.reference : undefined;
      const busySlot = slotReference ? await client.readReference({ reference: slotReference }) : undefined;
      expect(busySlot?.resourceType === 'Slot' && busySlot.status).toBe('busy');
    } finally {
      await persistence.reset();
    }
  }, 60_000);

  it('allows exactly one hosted $book winner for concurrent requests to the same Schedule window', async () => {
    const client = await liveClient();
    const baseline = await ensureLiveMedplumBaseline(new MedplumFhirRepository(client));
    const scheduler = new MedplumAtomicSchedulingRepository(client);
    const suffix = Date.now();
    const patient = await client.createResource<Patient>({
      resourceType: 'Patient', active: true,
      identifier: [{ system: DEMO_V1.identifierSystem, value: `${DEMO_V1.identifierPrefix}patient:slot-race-${suffix}` }],
      name: [{ text: `Synthetic slot race ${suffix}` }],
    });
    const cleanup: Resource[] = [patient];
    const makeDraft = (key: string) => buildAppointmentDraft({
      appointmentBusinessId: `slot-race-${suffix}-${key}`,
      patientReference: `Patient/${patient.id}`,
      healthcareServiceReference: baseline.healthcareServiceReference,
      slotReference: baseline.slotReference,
      startsAt: DEMO_V1.selectedSlot,
      endsAt: '2026-08-04T16:00:00.000Z',
      providerReference: baseline.providerReference,
    });

    try {
      const outcomes = await Promise.allSettled([scheduler.book(makeDraft('a')), scheduler.book(makeDraft('b'))]);
      const winners = outcomes.filter((outcome): outcome is PromiseFulfilledResult<Awaited<ReturnType<typeof scheduler.book>>> => outcome.status === 'fulfilled');
      const losers = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(losers[0]?.reason).toBeInstanceOf(SlotConflict);
      for (const winner of winners) cleanup.push(winner.value.appointment, ...winner.value.slots);
    } finally {
      for (const resource of cleanup.reverse()) {
        if (resource.id) await client.deleteResource(resource.resourceType, resource.id);
      }
    }
  }, 60_000);
});
