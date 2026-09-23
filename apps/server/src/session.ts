import { createHmac, timingSafeEqual } from 'node:crypto';

/** sessionKey = HMAC-SHA256(SESSION_SECRET, code + ":" + identity) em base64url. Nada fica guardado no servidor. */
export function signSessionKey(secret: string, code: string, identity: string): string {
  return createHmac('sha256', secret).update(`${code}:${identity}`).digest('base64url');
}

export function verifySessionKey(secret: string, code: string, identity: string, sessionKey: string): boolean {
  const expected = Buffer.from(signSessionKey(secret, code, identity));
  const given = Buffer.from(sessionKey);
  // timingSafeEqual exige o mesmo tamanho; comparar tamanhos não vaza o segredo.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}
