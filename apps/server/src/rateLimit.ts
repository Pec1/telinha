import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import type { Config } from './config.js';
import { errorBody } from './errors.js';

/**
 * IP do cliente. Atrás de proxy (Render), o primeiro IP do X-Forwarded-For é o cliente real;
 * sem o header, usa o endereço da conexão.
 */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? 'desconhecido';
  } catch {
    return 'desconhecido';
  }
}

function limiter(name: string, windowMs: number, limit: number): MiddlewareHandler {
  return rateLimiter({
    windowMs,
    limit,
    standardHeaders: 'draft-6',
    keyGenerator: (c) => `${name}:${clientIp(c)}`,
    statusCode: 429,
    message: errorBody('RATE_LIMITED'),
  });
}

const passthrough: MiddlewareHandler = (_c, next) => next();

export interface RateLimits {
  /** Criar sala: 5 a cada 10 minutos. */
  createRoom: MiddlewareHandler;
  /** join, rejoin, GET da sala e host-check: 30 por minuto. */
  entry: MiddlewareHandler;
  /** Ações de host: 60 por minuto. */
  hostAction: MiddlewareHandler;
}

/** Limites por IP em memória (processo único). */
export function createRateLimits(config: Config): RateLimits {
  if (!config.rateLimitEnabled) return { createRoom: passthrough, entry: passthrough, hostAction: passthrough };
  return {
    createRoom: limiter('create', 10 * 60_000, 5),
    entry: limiter('entry', 60_000, 30),
    hostAction: limiter('host', 60_000, 60),
  };
}
