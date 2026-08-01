import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import { buildAppointmentDraft, captureBookedReferences } from '../scheduling';

describe('Scheduling mapping', () => {
  it('creates a proposed appointment linked to Patient, Practitioner, service, and selected Slot', () => {
    const appointment = buildAppointmentDraft({
      appointmentBusinessId: 'appointment-workflow-1',
      patientReference: 'Patient/patient-1',
      healthcareServiceReference: 'HealthcareService/adult-primary-care',
      slotReference: 'Slot/slot-1030',
      startsAt: '2026-08-04T10:30:00-05:00',
      endsAt: '2026-08-04T11:00:00-05:00',
    });
    expect(appointment.status).toBe('proposed');
    expect(appointment.slot).toEqual([{ reference: 'Slot/slot-1030' }]);
    expect(appointment.participant?.map((participant) => participant.actor?.reference)).toEqual([
      'Patient/patient-1',
      DEMO_V1.practitionerRoleReference,
      'HealthcareService/adult-primary-care',
    ]);
  });

  it('captures returned server IDs instead of assuming requested identifiers propagate', () => {
    expect(captureBookedReferences({
      resourceType: 'Appointment',
      id: 'server-appt-9',
      meta: { versionId: '1' },
      status: 'booked',
      slot: [{ reference: 'Slot/server-slot-2' }],
      participant: [],
    })).toEqual({
      appointmentReference: 'Appointment/server-appt-9',
      appointmentVersionId: '1',
      slotReferences: ['Slot/server-slot-2'],
    });
  });

  it('rejects an incomplete booking response', () => {
    expect(() => captureBookedReferences({ resourceType: 'Appointment', status: 'booked', participant: [] })).toThrow(
      'Booked Appointment requires id, versionId, and Slot references',
    );
  });

  it('rejects a booked response with multiple Slot references', () => {
    expect(() => captureBookedReferences({
      resourceType: 'Appointment',
      id: 'server-appt-9',
      meta: { versionId: '1' },
      status: 'booked',
      slot: [{ reference: 'Slot/one' }, { reference: 'Slot/two' }],
      participant: [],
    })).toThrow('exactly one Slot reference');
  });

  it('rejects server references until the Appointment is actually booked', () => {
    expect(() => captureBookedReferences({
      resourceType: 'Appointment',
      id: 'server-appt-9',
      meta: { versionId: '1' },
      status: 'proposed',
      slot: [{ reference: 'Slot/server-slot-2' }],
      participant: [],
    })).toThrow('Appointment response is not booked');
  });

  it('rejects a booked response correlated to a different Slot', () => {
    expect(() => captureBookedReferences({
      resourceType: 'Appointment',
      id: 'server-appt-9',
      meta: { versionId: '1' },
      status: 'booked',
      slot: [{ reference: 'Slot/different' }],
      participant: [],
    }, 'Slot/requested')).toThrow('does not match the requested Slot');
  });
});
