import { z } from 'zod';

const booleanFlag = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

const rawEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3001),
  MEDPLUM_BASE_URL: z.url().default('https://api.medplum.com'),
  MEDPLUM_CLIENT_ID: z.string().min(1).optional(),
  MEDPLUM_CLIENT_SECRET: z.string().min(1).optional(),
  DEEPGRAM_API_KEY: z.string().min(1).optional(),
  STEDI_API_KEY: z.string().min(1).optional(),
  RUN_LIVE_MEDPLUM_TESTS: booleanFlag,
  RUN_LIVE_DEEPGRAM_TESTS: booleanFlag,
  RUN_LIVE_STEDI_TESTS: booleanFlag,
}).passthrough().superRefine((value, context) => {
  const browserSecrets = Object.keys(value).filter((key) => key.startsWith('VITE_') && /(KEY|SECRET|TOKEN)/.test(key));
  if (browserSecrets.length > 0) {
    context.addIssue({ code: 'custom', message: `Provider secrets cannot be browser-prefixed: ${browserSecrets.join(', ')}` });
  }
  if (value.RUN_LIVE_MEDPLUM_TESTS && !value.MEDPLUM_CLIENT_ID) context.addIssue({ code: 'custom', message: 'MEDPLUM_CLIENT_ID is required' });
  if (value.RUN_LIVE_MEDPLUM_TESTS && !value.MEDPLUM_CLIENT_SECRET) context.addIssue({ code: 'custom', message: 'MEDPLUM_CLIENT_SECRET is required' });
  if (value.RUN_LIVE_DEEPGRAM_TESTS && !value.DEEPGRAM_API_KEY) context.addIssue({ code: 'custom', message: 'DEEPGRAM_API_KEY is required' });
  if (value.RUN_LIVE_STEDI_TESTS && !value.STEDI_API_KEY) context.addIssue({ code: 'custom', message: 'STEDI_API_KEY is required' });
});

export type ServerEnv = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  medplumBaseUrl: string;
  medplumClientId?: string;
  medplumClientSecret?: string;
  deepgramApiKey?: string;
  stediApiKey?: string;
  liveMedplum: boolean;
  liveDeepgram: boolean;
  liveStedi: boolean;
};

export function parseServerEnv(environment: Record<string, string | undefined>): ServerEnv {
  const value = rawEnvironmentSchema.parse(environment);
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    medplumBaseUrl: value.MEDPLUM_BASE_URL,
    ...(value.MEDPLUM_CLIENT_ID ? { medplumClientId: value.MEDPLUM_CLIENT_ID } : {}),
    ...(value.MEDPLUM_CLIENT_SECRET ? { medplumClientSecret: value.MEDPLUM_CLIENT_SECRET } : {}),
    ...(value.DEEPGRAM_API_KEY ? { deepgramApiKey: value.DEEPGRAM_API_KEY } : {}),
    ...(value.STEDI_API_KEY ? { stediApiKey: value.STEDI_API_KEY } : {}),
    liveMedplum: value.RUN_LIVE_MEDPLUM_TESTS,
    liveDeepgram: value.RUN_LIVE_DEEPGRAM_TESTS,
    liveStedi: value.RUN_LIVE_STEDI_TESTS,
  };
}
