import { ConversationAdapterResultSchema, type ConversationAdapterResult } from '../contracts/provider';

const clinicalLanguage = /\b(chest pain|symptom|medicine|medication|dose|diagnos|headache|bleeding|shortness of breath|hurt|fever)\b/i;

export class ScriptedConversationAdapter {
  interpret(text: string): Promise<ConversationAdapterResult> {
    const normalized = text.trim();
    if (!normalized || clinicalLanguage.test(normalized)) {
      return Promise.reject(new Error('Only the closed administrative request grammar is accepted'));
    }

    if (/annual wellness|annual physical|wellness visit/i.test(normalized)) {
      const timeOfDay = /morning/i.test(normalized) ? 'morning' : /afternoon/i.test(normalized) ? 'afternoon' : undefined;
      return Promise.resolve(ConversationAdapterResultSchema.parse({
        provider: 'scripted',
        intent: { kind: 'annual-wellness-request', ...(timeOfDay ? { timeOfDay } : {}) },
      }));
    }

    return Promise.reject(new Error('Input did not match an administrative intent'));
  }
}
