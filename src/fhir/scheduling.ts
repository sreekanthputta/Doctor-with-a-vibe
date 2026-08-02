import type { Appointment, Bundle, Resource, Slot } from '@medplum/fhirtypes';
import { DEMO_V1 } from '../test/fixtures/demo-v1';
import { demoIdentifier } from './identifiers';

export interface SchedulingRepository {
  book(appointment: Appointment): Promise<Appointment>;
}

export class SlotConflict extends Error {
  constructor() {
    super('Slot is no longer free');
    this.name = 'SlotConflict';
  }
}

export type AtomicBookingEvidence = {
  appointment: Appointment;
  slots: Slot[];
};

type AtomicSchedulingTransport = {
  fhirUrl(...path: string[]): URL;
  readResource(resourceType: string, id: string): Promise<Resource>;
  post(url: URL, body: unknown): Promise<Bundle>;
};

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
      return Promise.reject(new SlotConflict());
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

function resourceReference(resource: Resource): string {
  if (!resource.id) throw new Error(`${resource.resourceType} booking output requires an id`);
  return `${resource.resourceType}/${resource.id}`;
}

function slotReferenceParts(appointment: Appointment): { reference: string; id: string } {
  const reference = requireSingleSlotReference(appointment);
  return { reference, id: reference.slice('Slot/'.length) };
}

function isAvailabilityConflict(error: unknown): boolean {
  return error instanceof Error && /not available|no longer free|overlap|conflict/i.test(error.message);
}

/** Hosted Medplum scheduling transport. `$book` atomically creates the Appointment and busy Slot evidence. */
export class MedplumAtomicSchedulingRepository {
  constructor(private readonly transport: AtomicSchedulingTransport) {}

  async book(appointment: Appointment): Promise<AtomicBookingEvidence> {
    const requested = slotReferenceParts(appointment);
    const freeSlot = await this.transport.readResource('Slot', requested.id);
    if (freeSlot.resourceType !== 'Slot' || freeSlot.status !== 'free' || !freeSlot.schedule.reference) {
      throw new SlotConflict();
    }
    if (freeSlot.start !== appointment.start || freeSlot.end !== appointment.end) {
      throw new Error('Requested Appointment does not match the selected Slot window');
    }
    const containedSlot: Slot = {
      resourceType: 'Slot',
      id: 'requested-slot-1',
      status: 'busy',
      schedule: structuredClone(freeSlot.schedule),
      start: freeSlot.start,
      end: freeSlot.end,
    };
    const proposed: Appointment = {
      ...structuredClone(appointment),
      slot: undefined,
      contained: [containedSlot],
    };
    let bundle: Bundle;
    try {
      bundle = await this.transport.post(this.transport.fhirUrl('Appointment', '$book'), {
        resourceType: 'Parameters',
        parameter: [{ name: 'appointment', resource: proposed }],
      });
    } catch (error) {
      if (isAvailabilityConflict(error)) throw new SlotConflict();
      throw error;
    }
    const resources = bundle.entry?.flatMap((entry) => entry.resource ? [entry.resource] : []) ?? [];
    const appointments = resources.filter((resource): resource is Appointment => resource.resourceType === 'Appointment');
    const slots = resources.filter((resource): resource is Slot => resource.resourceType === 'Slot');
    if (appointments.length !== 1 || slots.length < 1 || slots.some((slot) => slot.status !== 'busy' && slot.status !== 'busy-unavailable')) {
      throw new Error('Appointment $book returned incomplete committed evidence');
    }
    const booked = appointments[0];
    captureBookedReferences(booked);
    const returnedSlotReferences = new Set(slots.map(resourceReference));
    if (!booked.slot?.every((slot) => slot.reference && returnedSlotReferences.has(slot.reference))) {
      throw new Error('Appointment $book returned mismatched Slot evidence');
    }
    const businessId = appointment.identifier?.[0];
    if (businessId && !booked.identifier?.some((identifier) =>
      identifier.system === businessId.system && identifier.value === businessId.value)) {
      throw new Error('Appointment $book response lost the workflow identifier');
    }
    return { appointment: booked, slots };
  }
}

export function buildAppointmentDraft(input: {
  appointmentBusinessId: string;
  patientReference: string;
  healthcareServiceReference: string;
  slotReference: string;
  startsAt: string;
  endsAt: string;
  providerReference?: string;
}): Appointment {
  return {
    resourceType: 'Appointment',
    identifier: [demoIdentifier('appointment', input.appointmentBusinessId)],
    status: 'proposed',
    start: input.startsAt,
    end: input.endsAt,
    slot: [{ reference: input.slotReference }],
    serviceType: [{
      coding: [{ system: 'urn:vibedoc:service-type', code: DEMO_V1.visitType }],
      text: 'Adult annual wellness visit',
      extension: [{
        url: 'https://medplum.com/fhir/service-type-reference',
        valueReference: { reference: input.healthcareServiceReference },
      }],
    }],
    participant: [
      { actor: { reference: input.patientReference }, status: 'accepted' },
      { actor: { reference: input.providerReference ?? DEMO_V1.practitionerRoleReference }, status: 'accepted' },
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
