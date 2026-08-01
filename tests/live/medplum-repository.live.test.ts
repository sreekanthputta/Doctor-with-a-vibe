import { config } from 'dotenv';
import { MedplumClient } from '@medplum/core';
import type { Patient } from '@medplum/fhirtypes';
import { describe, expect, it } from 'vitest';
import { MedplumFhirRepository } from '../../src/adapters/medplum-fhir-repository';

config({ path: '.env.local', quiet: true });

const runLive = process.env.RUN_LIVE_MEDPLUM_TESTS === 'true';

describe.skipIf(!runLive)('MedplumFhirRepository live conformance', () => {
  it('conditionally creates, rereads, and cleans one namespaced synthetic Patient', async () => {
    const clientId = process.env.MEDPLUM_CLIENT_ID;
    const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Live Medplum credentials are required');

    const client = new MedplumClient({ baseUrl: process.env.MEDPLUM_BASE_URL ?? 'https://api.medplum.com' });
    await client.startClientLogin(clientId, clientSecret);
    const repository = new MedplumFhirRepository(client);
    const businessId = `demo-v1:live-conformance:${Date.now()}`;
    const patient: Patient = {
      resourceType: 'Patient',
      active: true,
      identifier: [{ system: 'urn:vibedoc:demo', value: businessId }],
      name: [{ use: 'official', given: ['Synthetic'], family: 'Conformance' }],
    };

    let createdId: string | undefined;
    try {
      const created = await repository.conditionalCreate(patient, `identifier=urn:vibedoc:demo|${businessId}`);
      createdId = created.resource.id;
      expect(created.created).toBe(true);
      expect(createdId).toBeTruthy();
      const reread = await repository.read<Patient>(`Patient/${createdId}`);
      expect(reread?.identifier?.[0]?.value).toBe(businessId);
      expect(reread?.meta?.versionId).toBeTruthy();
    } finally {
      if (createdId) await client.deleteResource('Patient', createdId);
    }
  });
});
