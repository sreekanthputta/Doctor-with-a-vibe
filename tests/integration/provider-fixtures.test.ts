import { describe, expect, it } from 'vitest';
import { ScriptedConversationAdapter } from '../../src/adapters/scripted-conversation';
import { StediEligibilityFixture } from '../../src/adapters/stedi-eligibility-fixture';

describe('deterministic provider fixtures', () => {
  it('emits the same validated intent without Deepgram', async () => {
    const adapter = new ScriptedConversationAdapter();
    await expect(adapter.interpret('I need an annual wellness visit in the morning')).resolves.toMatchObject({
      provider: 'scripted',
      intent: { kind: 'annual-wellness-request', timeOfDay: 'morning' },
    });
  });

  it('fails closed on clinical or mixed input', async () => {
    const adapter = new ScriptedConversationAdapter();
    await expect(adapter.interpret('I have chest pain and need an appointment')).rejects.toThrow(/administrative/i);
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
