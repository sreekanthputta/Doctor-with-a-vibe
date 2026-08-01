import { describe, expect, it } from 'vitest';
import { buildFollowUpRequest, buildDeliveredInAppCommunication } from '../communication';

describe('administrative follow-up communication', () => {
  it('distinguishes requested outreach from actual in-app delivery', () => {
    const request = buildFollowUpRequest({
      businessId: 'followup-workflow-1',
      patientReference: 'Patient/patient-1',
      taskReference: 'Task/task-1',
      authoredAt: '2026-08-01T15:00:00-05:00',
    });
    expect(request.status).toBe('active');
    expect(request.about).toEqual([{ reference: 'Task/task-1' }]);

    const delivered = buildDeliveredInAppCommunication({
      businessId: 'delivery-workflow-1',
      patientReference: 'Patient/patient-1',
      taskReference: 'Task/task-1',
      sentAt: '2026-08-01T15:00:05-05:00',
    });
    expect(delivered.status).toBe('completed');
    expect(delivered.sent).toBe('2026-08-01T15:00:05-05:00');
  });
});
