import { ConversationAdapterResultSchema, type ConversationAdapterResult } from '../contracts/provider';
import {
  evaluateAdministrativeText,
  type AdministrativeTextDecision,
} from '../domain/administrative-grammar';

export type ScriptedConversationDecision =
  | (Extract<AdministrativeTextDecision, { action: 'stop' }>)
  | {
    action: 'continue';
    originalText: string;
    result: ConversationAdapterResult;
  };

export class ScriptedConversationAdapter {
  evaluate(
    originalText: string,
    context: { workflowRunId: string } = { workflowRunId: 'unbound' },
  ): Promise<ScriptedConversationDecision> {
    const decision = evaluateAdministrativeText(originalText, context);
    if (decision.action === 'stop') return Promise.resolve(decision);
    return Promise.resolve({
      action: 'continue',
      originalText: decision.originalText,
      result: ConversationAdapterResultSchema.parse({
        provider: 'scripted',
        intent: decision.intent,
      }),
    });
  }

  async interpret(text: string): Promise<ConversationAdapterResult> {
    const decision = await this.evaluate(text);
    if (decision.action === 'stop') {
      throw new Error('Only the closed administrative request grammar is accepted');
    }
    return decision.result;
  }
}
