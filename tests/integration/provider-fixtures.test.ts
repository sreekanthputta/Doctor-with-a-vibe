import { describe, expect, it } from 'vitest';
import { ScriptedConversationAdapter } from '../../src/adapters/scripted-conversation';
import { StediEligibilityFixture } from '../../src/adapters/stedi-eligibility-fixture';

describe('deterministic provider fixtures', () => {
  it('emits the same validated intent without Deepgram', async () => {
    const adapter = new ScriptedConversationAdapter();
    const originalText = '  I need an annual wellness visit in the morning  ';
    await expect(adapter.evaluate(originalText, { workflowRunId: 'provider-run-1' })).resolves.toEqual({
      action: 'continue',
      originalText,
      result: {
        provider: 'scripted',
        intent: { kind: 'annual-wellness-request', timeOfDay: 'morning' },
      },
    });
  });

  it.each([
    ['I have a rash', 'clinical-language'],
    ['I feel dizzy', 'clinical-language'],
    ['I have nausea', 'clinical-language'],
    ['I am feeling off', 'clinical-language'],
    ['Book an annual wellness visit and check my rash', 'mixed-clinical-administrative'],
    ['I need an annual welness vist', 'administrative-unmatched'],
    ['Do not book an annual wellness visit', 'administrative-unmatched'],
  ] as const)('returns one exception and no booking for unsafe/unmatched provider text: %s', async (text, category) => {
    const adapter = new ScriptedConversationAdapter();
    const decision = await adapter.evaluate(text, { workflowRunId: 'provider-run-2' });

    expect(decision).toMatchObject({
      action: 'stop',
      originalText: text,
      category,
      exceptionCommand: {
        type: 'create-exception',
        payload: { category, status: 'requested' },
      },
    });
    expect(JSON.stringify(decision)).not.toContain('book-appointment');
  });

  it('does not run eligibility without the synthetic member ID', async () => {
    const adapter = new StediEligibilityFixture();
    await expect(adapter.check({ memberId: '' })).rejects.toThrow(/member ID/i);
    await expect(adapter.check({ memberId: 'AETNA-DEMO-2048' })).resolves.toMatchObject({
      source: 'fixture',
      outcome: 'complete',
      active: true,
    });
  });
});
