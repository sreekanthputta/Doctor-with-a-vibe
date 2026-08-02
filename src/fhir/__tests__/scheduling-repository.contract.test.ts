import { describe, expect, it, vi } from 'vitest';
import type { Appointment, Bundle, Slot } from '@medplum/fhirtypes';
import {
  buildAppointmentDraft,
  InMemorySchedulingRepository,
  MedplumAtomicSchedulingRepository,
  SlotConflict,
} from '../scheduling';

function appointment(id: string) {
  return buildAppointmentDraft({
    appointmentBusinessId: id,
    patientReference: `Patient/${id}`,
    healthcareServiceReference: 'HealthcareService/adult-primary-care',
    slotReference: 'Slot/slot-1030',
    startsAt: '2026-08-04T10:30:00-05:00',
    endsAt: '2026-08-04T11:00:00-05:00',
  });
}

describe('SchedulingRepository contract', () => {
  it('allows exactly one winner when two requests compete for one free Slot', async () => {
    const repository = new InMemorySchedulingRepository();
    const winner = repository.book(appointment('workflow-1'));
    const conflict = repository.book(appointment('workflow-2'));

    await expect(winner).resolves.toMatchObject({ status: 'booked' });
    await expect(conflict).rejects.toThrow('Slot is no longer free');
  });

  it('returns the same booking for an idempotent retry', async () => {
    const repository = new InMemorySchedulingRepository();
    const draft = appointment('workflow-1');
    const first = await repository.book(draft);
    const retry = await repository.book(draft);
    expect(retry).toEqual(first);
  });

  it('rejects a reservation unless the Appointment carries exactly one valid Slot reference', async () => {
    const repository = new InMemorySchedulingRepository();
    const draft = appointment('workflow-1');
    await expect(repository.book({ ...draft, slot: [] })).rejects.toThrow('exactly one Slot reference');
    await expect(repository.book({ ...draft, slot: [{ reference: 'Slot/one' }, { reference: 'Slot/two' }] }))
      .rejects.toThrow('exactly one Slot reference');
    await expect(repository.book({ ...draft, slot: [{ reference: 'Patient/not-a-slot' }] }))
      .rejects.toThrow('exactly one Slot reference');
  });
});

describe('Medplum atomic scheduling repository', () => {
  it('books through Appointment/$book and returns the committed Appointment and busy Slot evidence', async () => {
    const freeSlot: Slot = {
      resourceType: 'Slot', id: 'free-1', status: 'free', schedule: { reference: 'Schedule/live-1' },
      start: '2026-08-04T10:30:00-05:00', end: '2026-08-04T11:00:00-05:00',
    };
    const booked: Appointment = {
      ...appointment('workflow-1'), id: 'appt-live-1', meta: { versionId: '1' }, status: 'booked',
      slot: [{ reference: 'Slot/busy-1' }],
    };
    const busy: Slot = { ...freeSlot, id: 'busy-1', meta: { versionId: '1' }, status: 'busy' };
    const post = vi.fn((_url: URL, body: unknown): Promise<Bundle> => {
      const proposed = (body as { parameter: Array<{ resource: Appointment }> }).parameter[0]?.resource;
      expect(proposed?.slot).toBeUndefined();
      expect(proposed?.contained).toEqual([expect.objectContaining({ resourceType: 'Slot', status: 'busy' })]);
      return Promise.resolve({ resourceType: 'Bundle', type: 'transaction-response', entry: [{ resource: booked }, { resource: busy }] });
    });
    const repository = new MedplumAtomicSchedulingRepository({
      fhirUrl: (...path: string[]) => new URL(`https://example.test/fhir/R4/${path.join('/')}`),
      readResource: () => Promise.resolve(freeSlot),
      post,
    });

    const result = await repository.book(appointment('workflow-1'));

    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0]?.[0].pathname).toBe('/fhir/R4/Appointment/$book');
    expect(result).toEqual({ appointment: booked, slots: [busy] });
  });

  it('maps a hosted availability rejection to a typed SlotConflict', async () => {
    const repository = new MedplumAtomicSchedulingRepository({
      fhirUrl: (...path: string[]) => new URL(`https://example.test/fhir/R4/${path.join('/')}`),
      readResource: () => Promise.resolve({
        resourceType: 'Slot', id: 'free-1', status: 'free', schedule: { reference: 'Schedule/live-1' },
        start: '2026-08-04T10:30:00-05:00', end: '2026-08-04T11:00:00-05:00',
      }),
      post: () => Promise.reject(new Error('Requested time slot is not available')),
    });

    await expect(repository.book(appointment('workflow-2'))).rejects.toBeInstanceOf(SlotConflict);
  });
});
