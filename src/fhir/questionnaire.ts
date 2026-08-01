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
      return value === undefined ? [] : [answerItem(linkId, typeof value === 'string' ? value.trim() : value)];
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
  const canonical = `${DEMO_V1.questionnaire.url}|${DEMO_V1.questionnaire.version}`;
  if (response.questionnaire !== canonical) {
    throw new Error('QuestionnaireResponse canonical does not match the frozen intake version');
  }
  if (response.status !== 'in-progress') {
    throw new Error('Only an in-progress QuestionnaireResponse may be completed');
  }
  const patientReference = response.subject?.reference;
  if (!patientReference || !/^Patient\/[A-Za-z0-9.-]+$/.test(patientReference)
    || response.source?.reference !== patientReference || response.author?.reference !== patientReference) {
    throw new Error('QuestionnaireResponse subject, source, and author must reference the same bound patient');
  }
  const allowed = new Set<string>(DEMO_V1.questionnaire.linkIds);
  const items = response.item ?? [];
  if (items.some((item) => !allowed.has(item.linkId))) {
    throw new Error('QuestionnaireResponse may contain only allowed linkIds');
  }
  for (const linkId of DEMO_V1.questionnaire.linkIds) {
    const count = items.filter((item) => item.linkId === linkId).length;
    if (count === 0) throw new Error('Required intake answers are missing');
    if (count > 1) {
      throw new Error('Every required intake linkId must appear exactly once');
    }
  }
  const states = DEMO_V1.questionnaire.linkIds.map((linkId) => answerState(response, linkId));
  if (states.includes('missing')) {
    throw new Error('Required intake answers are missing');
  }
  if (states.includes('invalid')) throw new Error('Intake answer type is invalid');
  const normalizedItems = items.map((item) => ({
    ...item,
    answer: item.answer?.map((answer) => typeof answer.valueString === 'string'
      ? { ...answer, valueString: answer.valueString.trim() }
      : answer),
  }));
  if (normalizedItems.some((item) => item.answer?.some((answer) => answer.valueString !== undefined && answer.valueString.length === 0))) {
    throw new Error('Required string answers must be non-empty after trimming');
  }
  return {
    resource: { ...response, item: normalizedItems, status: 'completed' },
    expectedVersion: versioned.versionId,
  };
}
