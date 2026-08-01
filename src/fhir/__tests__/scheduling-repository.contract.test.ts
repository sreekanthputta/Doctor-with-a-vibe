import { describe, expect, it } from 'vitest';
import { buildAppointmentDraft, InMemorySchedulingRepository } from '../scheduling';

function appointment(id: string) {
  return buildAppointmentDraft({
    appointmentBusinessId: id,
    patientReference: `Patient/${id}`,
    practitionerReference: 'Practitioner/maya',
    healthcareServiceReference: 'HealthcareService/adult-primary-care',
    slotReference: 'Slot/slot-1030',
    startsAt: '2026-08-04T10:30:00-05:00',
    endsAt: '2026-08-04T11:00:00-05:00',
  });
}

describe('SchedulingRepository contract', () => {
  it('allows exactly one winner when two requests compete for one free Slot', async () => {
    const repository = new InMemorySchedulingRepository();
    const winner = repository.book('Slot/slot-1030', appointment('workflow-1'));
    const conflict = repository.book('Slot/slot-1030', appointment('workflow-2'));

    await expect(winner).resolves.toMatchObject({ status: 'booked' });
    await expect(conflict).rejects.toThrow('Slot is no longer free');
  });

  it('returns the same booking for an idempotent retry', async () => {
    const repository = new InMemorySchedulingRepository();
    const draft = appointment('workflow-1');
    const first = await repository.book('Slot/slot-1030', draft);
    const retry = await repository.book('Slot/slot-1030', draft);
    expect(retry).toEqual(first);
  });
});
