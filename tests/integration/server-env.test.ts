import { describe, expect, it } from 'vitest';
import { parseServerEnv } from '../../src/server/env';

describe('server environment boundary', () => {
  it('starts in deterministic fixture mode without provider credentials', () => {
    expect(parseServerEnv({ NODE_ENV: 'test', PORT: '3001' })).toMatchObject({
      port: 3001,
      liveMedplum: false,
      liveDeepgram: false,
      liveStedi: false,
    });
  });

  it('requires credentials only when a live provider gate is enabled', () => {
    expect(() => parseServerEnv({ RUN_LIVE_MEDPLUM_TESTS: 'true' })).toThrow(/MEDPLUM_CLIENT_ID/);
    expect(() => parseServerEnv({ RUN_LIVE_DEEPGRAM_TESTS: 'true' })).toThrow(/DEEPGRAM_API_KEY/);
    expect(() => parseServerEnv({ RUN_LIVE_STEDI_TESTS: 'true' })).toThrow(/STEDI_API_KEY/);
  });

  it('rejects any browser-prefixed provider secret', () => {
    expect(() => parseServerEnv({ VITE_DEEPGRAM_API_KEY: 'not-allowed' })).toThrow(/browser/i);
    expect(() => parseServerEnv({ VITE_MEDPLUM_CLIENT_SECRET: 'not-allowed' })).toThrow(/browser/i);
  });
});
