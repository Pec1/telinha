import { z } from 'zod';

const intFromEnv = (fallback: number, min: number) =>
  z.coerce.number().int().min(min).default(fallback);

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: intFromEnv(8787, 1),
  LIVEKIT_URL: z.url({ protocol: /^wss?$|^https?$/ }),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  SESSION_SECRET: z.string().min(16, { error: 'SESSION_SECRET precisa ter pelo menos 16 caracteres.' }),
  MAX_PARTICIPANTS: intFromEnv(25, 2),
  MAX_SHARERS: intFromEnv(4, 1),
  EMPTY_TIMEOUT_SECONDS: intFromEnv(300, 10),
  HOST_GRACE_SECONDS: intFromEnv(20, 0),
});

export interface Config {
  isProduction: boolean;
  port: number;
  livekit: { url: string; apiKey: string; apiSecret: string };
  sessionSecret: string;
  maxParticipants: number;
  maxSharers: number;
  emptyTimeoutSeconds: number;
  hostGraceSeconds: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Variáveis vazias contam como ausentes (o default se aplica).
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  const e = parsed.data;
  return {
    isProduction: e.NODE_ENV === 'production',
    port: e.PORT,
    livekit: { url: e.LIVEKIT_URL, apiKey: e.LIVEKIT_API_KEY, apiSecret: e.LIVEKIT_API_SECRET },
    sessionSecret: e.SESSION_SECRET,
    maxParticipants: e.MAX_PARTICIPANTS,
    maxSharers: e.MAX_SHARERS,
    emptyTimeoutSeconds: e.EMPTY_TIMEOUT_SECONDS,
    hostGraceSeconds: e.HOST_GRACE_SECONDS,
  };
}
