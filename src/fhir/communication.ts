import type { Communication, CommunicationRequest } from '@medplum/fhirtypes';
import { demoIdentifier } from './identifiers';

export function buildFollowUpRequest(input: {
  businessId: string;
  patientReference: string;
  taskReference: string;
  authoredAt: string;
}): CommunicationRequest {
  return {
    resourceType: 'CommunicationRequest',
    identifier: [demoIdentifier('communication-request', input.businessId)],
    status: 'active',
    subject: { reference: input.patientReference },
    about: [{ reference: input.taskReference }],
    authoredOn: input.authoredAt,
    payload: [{ contentString: 'Additional administrative information is needed before your visit.' }],
  };
}

export function buildDeliveredInAppCommunication(input: {
  businessId: string;
  patientReference: string;
  taskReference: string;
  sentAt: string;
}): Communication {
  return {
    resourceType: 'Communication',
    identifier: [demoIdentifier('communication', input.businessId)],
    status: 'completed',
    subject: { reference: input.patientReference },
    about: [{ reference: input.taskReference }],
    sent: input.sentAt,
    medium: [{ coding: [{ system: 'urn:vibedoc:communication-medium', code: 'in-app' }] }],
    payload: [{ contentString: 'Additional administrative information is needed before your visit.' }],
  };
}
