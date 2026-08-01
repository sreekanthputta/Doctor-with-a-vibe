import type { Appointment } from '@medplum/fhirtypes';
import { demoIdentifier } from './identifiers';

export interface SchedulingRepository {
  book(slotReference: string, appointment: Appointment): Promise<Appointment>;
}

/** Deterministic fixture repository; live `$book` conformance is implemented in Wave 2. */
export class InMemorySchedulingRepository implements SchedulingRepository {
  readonly #bookings = new Map<string, Appointment>();

  book(slotReference: string, appointment: Appointment): Promise<Appointment> {
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
  practitionerReference: string;
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
      { actor: { reference: input.practitionerReference }, status: 'accepted' },
      { actor: { reference: input.healthcareServiceReference }, status: 'accepted' },
    ],
  };
}

export function captureBookedReferences(appointment: Appointment): {
  appointmentReference: string;
  appointmentVersionId: string;
  slotReferences: string[];
} {
  if (appointment.status !== 'booked') {
    throw new Error('Appointment response is not booked');
  }
  const slotReferences = appointment.slot?.flatMap((slot) => slot.reference ? [slot.reference] : []) ?? [];
  if (!appointment.id || !appointment.meta?.versionId || slotReferences.length === 0) {
    throw new Error('Booked Appointment requires id, versionId, and Slot references');
  }
  return {
    appointmentReference: `Appointment/${appointment.id}`,
    appointmentVersionId: appointment.meta.versionId,
    slotReferences,
  };
}
