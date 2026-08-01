import { describe, expect, it } from 'vitest';
import { DEMO_V1 } from '../../test/fixtures/demo-v1';
import {
  buildAdultWellnessQuestionnaire,
  buildQuestionnaireResponse,
  planQuestionnaireResponseCompletion,
} from '../questionnaire';

describe('Questionnaire mapping', () => {
  it('freezes the canonical URL, version, required linkIds, and value types', () => {
    const questionnaire = buildAdultWellnessQuestionnaire();
    expect(questionnaire.url).toBe(DEMO_V1.questionnaire.url);
    expect(questionnaire.version).toBe(DEMO_V1.questionnaire.version);
    expect(questionnaire.status).toBe('active');
    expect(questionnaire.item?.map(({ linkId, type, required }) => ({ linkId, type, required }))).toEqual([
      { linkId: 'contact-email', type: 'string', required: true },
      { linkId: 'contact-phone', type: 'string', required: true },
      { linkId: 'coverage-payer-name', type: 'string', required: true },
      { linkId: 'coverage-member-id', type: 'string', required: true },
      { linkId: 'administrative-communication-consent', type: 'boolean', required: true },
    ]);
  });

  it('keeps patient-reported intake in progress while member ID is absent', () => {
    const response = buildQuestionnaireResponse({
      patientReference: 'Patient/patient-1',
      authoredAt: DEMO_V1.clock,
      answers: {
        'contact-email': 'maria@example.test',
        'contact-phone': '3125550101',
        'coverage-payer-name': 'Aetna',
        'administrative-communication-consent': true,
      },
    });

    expect(response.status).toBe('in-progress');
    expect(response.questionnaire).toBe(`${DEMO_V1.questionnaire.url}|${DEMO_V1.questionnaire.version}`);
    expect(response.subject).toEqual({ reference: 'Patient/patient-1' });
    expect(response.source).toEqual({ reference: 'Patient/patient-1' });
    expect(response.author).toEqual({ reference: 'Patient/patient-1' });
    expect(response.item?.some((item) => item.linkId === 'coverage-member-id')).toBe(false);
  });

  it('completes only a versioned response containing every required answer', () => {
    const incomplete = buildQuestionnaireResponse({
      patientReference: 'Patient/patient-1',
      authoredAt: DEMO_V1.clock,
      answers: {
        'contact-email': 'maria@example.test',
        'contact-phone': '3125550101',
        'coverage-payer-name': 'Aetna',
        'administrative-communication-consent': true,
      },
    });
    const versioned = { ...incomplete, id: 'qr-1', meta: { versionId: '2' } };

    expect(() => planQuestionnaireResponseCompletion(versioned)).toThrow('Required intake answers are missing');

    const withMember = {
      ...versioned,
      item: [...(versioned.item ?? []), { linkId: 'coverage-member-id', answer: [{ valueString: DEMO_V1.memberId }] }],
    };
    const completion = planQuestionnaireResponseCompletion(withMember);
    expect(completion.expectedVersion).toBe('2');
    expect(completion.resource.status).toBe('completed');
  });

  it('rejects an answer with the wrong FHIR value type', () => {
    const response = buildQuestionnaireResponse({
      patientReference: 'Patient/patient-1',
      authoredAt: DEMO_V1.clock,
      answers: {
        'contact-email': 'maria@example.test',
        'contact-phone': '3125550101',
        'coverage-payer-name': 'Aetna',
        'coverage-member-id': DEMO_V1.memberId,
        'administrative-communication-consent': true,
      },
    });
    const malformed = {
      ...response,
      id: 'qr-1',
      meta: { versionId: '2' },
      item: response.item?.map((item) => item.linkId === 'administrative-communication-consent'
        ? { linkId: item.linkId, answer: [{ valueString: 'yes' }] }
        : item),
    };
    expect(() => planQuestionnaireResponseCompletion(malformed)).toThrow('Intake answer type is invalid');
  });

  it('rejects the wrong canonical, status, duplicate/unknown linkIds, or mismatched patient binding', () => {
    const response = {
      ...buildQuestionnaireResponse({
        patientReference: 'Patient/patient-1',
        authoredAt: DEMO_V1.clock,
        answers: {
          'contact-email': ' maria@example.test ',
          'contact-phone': ' 3125550101 ',
          'coverage-payer-name': ' Aetna ',
          'coverage-member-id': ` ${DEMO_V1.memberId} `,
          'administrative-communication-consent': true,
        },
      }),
      id: 'qr-1',
      meta: { versionId: '2' },
    };
    expect(() => planQuestionnaireResponseCompletion({ ...response, questionnaire: 'urn:wrong|v1' }))
      .toThrow('canonical');
    expect(() => planQuestionnaireResponseCompletion({ ...response, status: 'completed' }))
      .toThrow('in-progress');
    expect(() => planQuestionnaireResponseCompletion({ ...response, source: { reference: 'Patient/other' } }))
      .toThrow('same bound patient');
    const duplicate = response.item?.[0];
    if (!duplicate) throw new Error('Test fixture must include an intake item');
    expect(() => planQuestionnaireResponseCompletion({ ...response, item: [...(response.item ?? []), duplicate] }))
      .toThrow('exactly once');
    expect(() => planQuestionnaireResponseCompletion({ ...response, item: [...(response.item ?? []), { linkId: 'unexpected' }] }))
      .toThrow('allowed linkIds');

    const completion = planQuestionnaireResponseCompletion(response);
    expect(completion.resource.item?.find((item) => item.linkId === 'coverage-payer-name')?.answer?.[0]?.valueString)
      .toBe('Aetna');
  });

  it('rejects blank required strings after trimming', () => {
    const response = {
      ...buildQuestionnaireResponse({
        patientReference: 'Patient/patient-1',
        authoredAt: DEMO_V1.clock,
        answers: {
          'contact-email': 'maria@example.test',
          'contact-phone': '3125550101',
          'coverage-payer-name': '   ',
          'coverage-member-id': DEMO_V1.memberId,
          'administrative-communication-consent': true,
        },
      }),
      id: 'qr-1',
      meta: { versionId: '2' },
    };
    expect(() => planQuestionnaireResponseCompletion(response)).toThrow('non-empty');
  });
});
