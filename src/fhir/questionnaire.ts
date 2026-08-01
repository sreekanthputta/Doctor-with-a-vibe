import type {
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
} from '@medplum/fhirtypes';
import { DEMO_V1 } from '../test/fixtures/demo-v1';
import { demoIdentifier, requireVersionedReference } from './identifiers';

type IntakeLinkId = (typeof DEMO_V1.questionnaire.linkIds)[number];
type IntakeAnswers = Partial<Record<IntakeLinkId, string | boolean>>;

const itemTypes: Record<IntakeLinkId, 'string' | 'boolean'> = {
  'contact-email': 'string',
  'contact-phone': 'string',
  'coverage-payer-name': 'string',
  'coverage-member-id': 'string',
  'administrative-communication-consent': 'boolean',
};

export function buildAdultWellnessQuestionnaire(): Questionnaire {
  return {
    resourceType: 'Questionnaire',
    identifier: [demoIdentifier('questionnaire', 'adult-annual-wellness-intake')],
    url: DEMO_V1.questionnaire.url,
    version: DEMO_V1.questionnaire.version,
    status: 'active',
    title: 'Adult annual wellness intake',
    item: DEMO_V1.questionnaire.linkIds.map((linkId) => ({
      linkId,
      type: itemTypes[linkId],
      required: true,
      text: linkId,
    })),
  };
}

function answerItem(linkId: IntakeLinkId, value: string | boolean): QuestionnaireResponseItem {
  return {
    linkId,
    answer: [typeof value === 'boolean' ? { valueBoolean: value } : { valueString: value }],
  };
}

export function buildQuestionnaireResponse(input: {
  patientReference: string;
  authoredAt: string;
  answers: IntakeAnswers;
  responseBusinessId?: string;
}): QuestionnaireResponse {
  return {
    resourceType: 'QuestionnaireResponse',
    identifier: demoIdentifier('questionnaire-response', input.responseBusinessId ?? 'adult-wellness'),
    questionnaire: `${DEMO_V1.questionnaire.url}|${DEMO_V1.questionnaire.version}`,
    status: 'in-progress',
    subject: { reference: input.patientReference },
    source: { reference: input.patientReference },
    author: { reference: input.patientReference },
    authored: input.authoredAt,
    item: DEMO_V1.questionnaire.linkIds.flatMap((linkId) => {
      const value = input.answers[linkId];
      return value === undefined ? [] : [answerItem(linkId, value)];
    }),
  };
}

function answerState(response: QuestionnaireResponse, linkId: IntakeLinkId): 'missing' | 'valid' | 'invalid' {
  const item = response.item?.find((candidate) => candidate.linkId === linkId);
  if (!item?.answer?.length) return 'missing';
  if (item.answer.length !== 1) return 'invalid';
  const answer = item.answer[0];
  if (!answer) return 'missing';
  const valid = itemTypes[linkId] === 'boolean'
    ? typeof answer.valueBoolean === 'boolean' && answer.valueString === undefined
    : typeof answer.valueString === 'string' && answer.valueBoolean === undefined;
  return valid ? 'valid' : 'invalid';
}

export function planQuestionnaireResponseCompletion(response: QuestionnaireResponse): {
  resource: QuestionnaireResponse;
  expectedVersion: string;
} {
  const versioned = requireVersionedReference(response);
  const states = DEMO_V1.questionnaire.linkIds.map((linkId) => answerState(response, linkId));
  if (states.includes('missing')) {
    throw new Error('Required intake answers are missing');
  }
  if (states.includes('invalid')) throw new Error('Intake answer type is invalid');
  return { resource: { ...response, status: 'completed' }, expectedVersion: versioned.versionId };
}
