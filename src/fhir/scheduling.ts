import type { Appointment } from '@medplum/fhirtypes';
import { DEMO_V1 } from '../test/fixtures/demo-v1';
import { demoIdentifier } from './identifiers';

export interface SchedulingRepository {
  book(appointment: Appointment): Promise<Appointment>;
}

function requireSingleSlotReference(appointment: Appointment): string {
  const references = appointment.slot?.map((slot) => slot.reference).filter((reference): reference is string => Boolean(reference)) ?? [];
  if (appointment.slot?.length !== 1 || references.length !== 1 || !/^Slot\/[A-Za-z0-9.-]+$/.test(references[0] ?? '')) {
    throw new Error('Appointment requires exactly one Slot reference');
  }
  return references[0];
}

/** Deterministic fixture repository; live `$book` conformance is implemented in Wave 2. */
export class InMemorySchedulingRepository implements SchedulingRepository {
  readonly #bookings = new Map<string, Appointment>();

  book(appointment: Appointment): Promise<Appointment> {
    let slotReference: string;
    try {
      slotReference = requireSingleSlotReference(appointment);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('Appointment Slot validation failed'));
    }
    const existing = this.#bookings.get(slotReference);
    const businessId = appointment.identifier?.[0]?.value;
    if (existing) {
      if (businessId && existing.identifier?.some((identifier) => identifier.value === businessId)) {
        return Promise.resolve(structuredClone(existing));
      }
      return Promise.reject(new Error('Slot is no longer free'));
    }
    const booked: Appointment = {
      ...structuredClone(appointment),
      id: `fixture-appointment-${this.#bookings.size + 1}`,
      meta: { versionId: '1' },
      status: 'booked',
    };
    this.#bookings.set(slotReference, booked);
    return Promise.resolve(structuredClone(booked));
  }
}

export function buildAppointmentDraft(input: {
  appointmentBusinessId: string;
  patientReference: string;
  healthcareServiceReference: string;
  slotReference: string;
  startsAt: string;
  endsAt: string;
}): Appointment {
  return {
    resourceType: 'Appointment',
    identifier: [demoIdentifier('appointment', input.appointmentBusinessId)],
    status: 'proposed',
    start: input.startsAt,
    end: input.endsAt,
    slot: [{ reference: input.slotReference }],
    participant: [
      { actor: { reference: input.patientReference }, status: 'accepted' },
      { actor: { reference: DEMO_V1.practitionerRoleReference }, status: 'accepted' },
      { actor: { reference: input.healthcareServiceReference }, status: 'accepted' },
    ],
  };
}

export function captureBookedReferences(appointment: Appointment, expectedSlotReference?: string): {
  appointmentReference: string;
  appointmentVersionId: string;
  slotReferences: string[];
} {
  if (appointment.status !== 'booked') {
    throw new Error('Appointment response is not booked');
  }
  if (!appointment.id || !appointment.meta?.versionId) {
    throw new Error('Booked Appointment requires id, versionId, and Slot references');
  }
  const slotReference = requireSingleSlotReference(appointment);
  if (expectedSlotReference && slotReference !== expectedSlotReference) {
    throw new Error('Booked Appointment does not match the requested Slot');
  }
  return {
    appointmentReference: `Appointment/${appointment.id}`,
    appointmentVersionId: appointment.meta.versionId,
    slotReferences: [slotReference],
  };
}
