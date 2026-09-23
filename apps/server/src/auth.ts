import type { Context } from 'hono';
import type { Config } from './config.js';
import { ApiError } from './errors.js';
import { bearerToken, verifySessionKey } from './session.js';

/** Confere o sessionKey (Authorization: Bearer) para o par code + identity. */
export function requireSession(c: Context, config: Config, code: string, identity: string): void {
  const key = bearerToken(c.req.header('Authorization'));
  if (!key || !verifySessionKey(config.sessionSecret, code, identity, key)) {
    throw new ApiError(401, 'UNAUTHORIZED');
  }
}
