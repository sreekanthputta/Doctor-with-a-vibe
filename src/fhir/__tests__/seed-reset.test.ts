import { describe, expect, it } from 'vitest';
import { BASELINE_SEED_MANIFEST, planNamespacedReset } from '../../demo/seed/manifest';

describe('synthetic seed/reset manifest', () => {
  it('contains practice resources but excludes Maria workflow resources', () => {
    const types = BASELINE_SEED_MANIFEST.resources.map((resource) => resource.resourceType);
    expect(types).toEqual(expect.arrayContaining(['Practitioner', 'PractitionerRole', 'HealthcareService', 'Schedule', 'Slot', 'Questionnaire', 'Organization']));
    expect(types).not.toEqual(expect.arrayContaining(['Patient', 'Appointment', 'Coverage', 'QuestionnaireResponse', 'Task', 'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'Provenance']));
    expect(JSON.stringify(BASELINE_SEED_MANIFEST)).not.toContain('AETNA-DEMO-2048');
    const firstResource = BASELINE_SEED_MANIFEST.resources[0];
    expect(Object.isFrozen(firstResource)).toBe(true);
    expect(firstResource && 'identifier' in firstResource && Object.isFrozen(firstResource.identifier)).toBe(true);
  });

  it('reset targets only identifiers explicitly recorded in the namespaced run manifest', () => {
    const plan = planNamespacedReset({
      namespace: 'demo-v1',
      developmentAdmin: true,
      createdReferences: ['Patient/p-1', 'Appointment/a-1', 'Slot/s-1'],
    });
    expect(plan.references).toEqual(['Patient/p-1', 'Appointment/a-1', 'Slot/s-1']);
    expect(plan.allowBroadDelete).toBe(false);
  });

  it('refuses reset outside an explicit development/admin context', () => {
    expect(() => planNamespacedReset({
      namespace: 'demo-v1',
      developmentAdmin: false,
      createdReferences: ['Patient/p-1'],
    })).toThrow('Reset requires explicit development/admin context');
  });
});
