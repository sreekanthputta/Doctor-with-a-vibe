export const DEMO_V1 = Object.freeze({
  clock: '2026-08-01T15:00:00-05:00',
  timezone: 'America/Chicago',
  identifierSystem: 'urn:vibedoc:demo',
  identifierPrefix: 'demo-v1:',
  physician: { display: 'Dr. Maya Chen', persona: 'maya-demo' },
  patient: {
    persona: 'maria-demo',
    givenName: 'Maria',
    familyName: 'Lopez',
    birthDate: '1974-02-14',
    postalCode: '60601',
  },
  visitType: 'adult-annual-wellness',
  offeredSlots: ['2026-08-04T09:30:00-05:00', '2026-08-04T10:30:00-05:00'],
  selectedSlot: '2026-08-04T10:30:00-05:00',
  memberId: 'AETNA-DEMO-2048',
  questionnaire: {
    url: 'urn:vibedoc:questionnaire:adult-annual-wellness-intake',
    version: 'demo-v1',
    linkIds: [
      'contact-email',
      'contact-phone',
      'coverage-payer-name',
      'coverage-member-id',
      'administrative-communication-consent',
    ],
  },
} as const);
