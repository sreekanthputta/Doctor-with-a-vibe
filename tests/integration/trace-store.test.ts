import { describe, expect, it } from 'vitest';
import { TraceStore } from '../../src/server/trace-store';

describe('TraceStore', () => {
  it('updates one trace row in place and emits role-safe projections', () => {
    const timestamps = ['2026-08-01T12:00:00.000Z', '2026-08-01T12:00:01.000Z'];
    const store = new TraceStore(() => timestamps.shift() ?? '2026-08-01T12:00:01.000Z');
    store.start({
      sessionId: 'session-patient',
      role: 'patient-demo',
      traceId: 'trace-1',
      messageId: 'message-1',
      toolName: 'book_appointment',
      input: { slotDisplay: 'Aug 4, 10:30 AM', internalPatientId: 'Patient/secret' },
    });
    store.complete('session-patient', 'trace-1', {
      appointmentDisplay: 'Aug 4, 10:30 AM',
      rawResource: { resourceType: 'Appointment', id: 'secret' },
    });

    expect(store.snapshot('session-patient', 'patient-demo')).toEqual([
      expect.objectContaining({
        traceId: 'trace-1',
        status: 'succeeded',
        startedAt: '2026-08-01T12:00:00.000Z',
        completedAt: '2026-08-01T12:00:01.000Z',
        safeInput: { slotDisplay: 'Aug 4, 10:30 AM' },
        safeOutput: { appointmentDisplay: 'Aug 4, 10:30 AM' },
      }),
    ]);
  });

  it('never returns another session or role trace', () => {
    const store = new TraceStore();
    store.start({ sessionId: 'physician', role: 'physician-demo', traceId: 't', messageId: 'm', toolName: 'get_ready_visit', input: {} });
    expect(store.snapshot('patient', 'patient-demo')).toEqual([]);
    expect(() => store.snapshot('physician', 'patient-demo')).toThrow(/role/i);
  });

  it('blocks the existing row without exposing non-allowlisted output', () => {
    const store = new TraceStore();
    store.start({
      sessionId: 'public',
      role: 'public',
      traceId: 'trace-blocked',
      messageId: 'message-booking',
      toolName: 'book_appointment',
      input: { slotDisplay: 'Tuesday morning', patientId: 'Patient/secret' },
    });

    store.block('public', 'trace-blocked', {
      appointmentDisplay: 'No appointment mutation performed',
      rawProviderPayload: { secret: true },
    });

    expect(store.snapshot('public', 'public')).toEqual([
      expect.objectContaining({
        traceId: 'trace-blocked',
        status: 'blocked',
        safeInput: { slotDisplay: 'Tuesday morning' },
        safeOutput: { appointmentDisplay: 'No appointment mutation performed' },
      }),
    ]);
  });
});
