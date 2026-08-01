import { describe, expect, it } from 'vitest';
import { TraceStore } from '../../src/server/trace-store';

describe('TraceStore', () => {
  it('updates one trace row in place and emits role-safe projections', () => {
    const store = new TraceStore();
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
});
