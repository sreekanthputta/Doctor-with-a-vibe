import { describe, expect, it } from 'vitest';
import {
  BASELINE_SEED_MANIFEST,
  createServerOwnedRunManifest,
  planNamespacedReset,
  recordCreatedRunResource,
} from '../../demo/seed/manifest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';

describe('synthetic seed/reset manifest', () => {
  it('contains practice resources but excludes Maria workflow resources', () => {
    const types = BASELINE_SEED_MANIFEST.resources.map((resource) => resource.resourceType);
    expect(types).toEqual(expect.arrayContaining(['Practitioner', 'PractitionerRole', 'HealthcareService', 'Schedule', 'Slot', 'Questionnaire', 'Organization']));
    expect(types).not.toEqual(expect.arrayContaining(['Patient', 'Appointment', 'Coverage', 'QuestionnaireResponse', 'Task', 'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'Provenance']));
    expect(JSON.stringify(BASELINE_SEED_MANIFEST)).not.toContain('AETNA-DEMO-2048');
    const firstResource = BASELINE_SEED_MANIFEST.resources[0];
    expect(Object.isFrozen(firstResource)).toBe(true);
    expect(firstResource && 'identifier' in firstResource && Object.isFrozen(firstResource.identifier)).toBe(true);
    const schedule = BASELINE_SEED_MANIFEST.resources.find((resource) => resource.resourceType === 'Schedule');
    expect(schedule?.resourceType === 'Schedule' ? schedule.actor : undefined).toContainEqual({
      reference: DEMO_V1.practitionerRoleReference,
    });
  });

  it('reset targets only identifiers explicitly recorded in the namespaced run manifest', () => {
    const manifest = createServerOwnedRunManifest({ namespace: 'demo-v1', runId: 'run-1' });
    recordCreatedRunResource(manifest, {
      resourceType: 'Patient', id: 'p-1', identifier: [{ system: 'urn:vibedoc:demo', value: 'demo-v1:patient:run-1' }],
    });
    recordCreatedRunResource(manifest, {
      resourceType: 'Appointment', id: 'a-1', status: 'booked', participant: [],
      identifier: [{ system: 'urn:vibedoc:demo', value: 'demo-v1:appointment:run-1' }],
    });
    const plan = planNamespacedReset({ developmentAdmin: true, manifest });
    expect(plan.references).toEqual(['Patient/p-1', 'Appointment/a-1']);
    expect(plan.allowBroadDelete).toBe(false);
  });

  it('refuses reset outside an explicit development/admin context', () => {
    const manifest = createServerOwnedRunManifest({ namespace: 'demo-v1', runId: 'run-2' });
    expect(() => planNamespacedReset({ developmentAdmin: false, manifest }))
      .toThrow('Reset requires explicit development/admin context');
  });

  it('rejects forged manifests, arbitrary resources, and baseline references', () => {
    const manifest = createServerOwnedRunManifest({ namespace: 'demo-v1', runId: 'run-3' });
    expect(() => planNamespacedReset({ developmentAdmin: true, manifest: { namespace: 'demo-v1', runId: 'forged' } as never }))
      .toThrow('server-owned');
    expect(() => recordCreatedRunResource(manifest, {
      resourceType: 'Patient', id: 'arbitrary', identifier: [{ system: 'other', value: 'arbitrary' }],
    })).toThrow('namespaced run resource');
    expect(() => recordCreatedRunResource(manifest, BASELINE_SEED_MANIFEST.resources.find((resource) => resource.resourceType === 'Slot')!))
      .toThrow('baseline resource');
  });
});
