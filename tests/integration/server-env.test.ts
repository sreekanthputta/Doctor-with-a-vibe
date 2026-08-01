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
    expect(() => parseServerEnv({ USE_LIVE_MEDPLUM: 'true' })).toThrow(/MEDPLUM_CLIENT_ID/);
    expect(() => parseServerEnv({ RUN_LIVE_DEEPGRAM_TESTS: 'true' })).toThrow(/DEEPGRAM_API_KEY/);
    expect(() => parseServerEnv({ RUN_LIVE_STEDI_TESTS: 'true' })).toThrow(/STEDI_API_KEY/);
  });

  it('enables live workflow persistence only with server-side Medplum credentials', () => {
    expect(parseServerEnv({
      NODE_ENV: 'development',
      USE_LIVE_MEDPLUM: 'true',
      MEDPLUM_CLIENT_ID: 'synthetic-client',
      MEDPLUM_CLIENT_SECRET: 'synthetic-secret',
    })).toMatchObject({ useLiveMedplum: true });
  });

  it('rejects any browser-prefixed provider secret', () => {
    expect(() => parseServerEnv({ VITE_DEEPGRAM_API_KEY: 'not-allowed' })).toThrow(/browser/i);
    expect(() => parseServerEnv({ VITE_MEDPLUM_CLIENT_SECRET: 'not-allowed' })).toThrow(/browser/i);
  });

  it('fails closed for reset by default and forbids production reset', () => {
    expect(parseServerEnv({})).toMatchObject({ nodeEnv: 'production', enableDemoReset: false });
    expect(() => parseServerEnv({ NODE_ENV: 'production', ENABLE_DEMO_RESET: 'true', DEMO_RESET_TOKEN: 'long-enough-reset-token' })).toThrow(/production/i);
    expect(() => parseServerEnv({ NODE_ENV: 'test', ENABLE_DEMO_RESET: 'true' })).toThrow(/DEMO_RESET_TOKEN/i);
  });
});
