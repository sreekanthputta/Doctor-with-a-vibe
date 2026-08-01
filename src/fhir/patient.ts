import type { Identifier, Patient } from '@medplum/fhirtypes';
import { DEMO_V1 } from '../test/fixtures/demo-v1';
import { demoIdentifier } from './identifiers';

export interface ConditionalCreate<T> {
  resource: T;
  ifNoneExist: string;
}

export function buildDemoPatientIdentifier(): Identifier {
  return demoIdentifier('patient', DEMO_V1.patient.persona);
}

export function buildDemoPatientCreate(): ConditionalCreate<Patient> {
  const identifier = buildDemoPatientIdentifier();
  return {
    resource: {
      resourceType: 'Patient',
      active: true,
      identifier: [identifier],
      name: [{ family: DEMO_V1.patient.familyName, given: [DEMO_V1.patient.givenName] }],
      birthDate: DEMO_V1.patient.birthDate,
      address: [{ postalCode: DEMO_V1.patient.postalCode }],
    },
    ifNoneExist: `identifier=${encodeURIComponent(`${identifier.system}|${identifier.value}`)}`,
  };
}
