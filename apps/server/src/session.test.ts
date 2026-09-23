import { describe, expect, it } from 'vitest';
import { bearerToken, signSessionKey, verifySessionKey } from './session.js';
import { createHmac } from 'node:crypto';

describe('sessionKey', () => {
  const secret = 'segredo';

  it('é HMAC-SHA256(secret, code:identity) em base64url', () => {
    const expected = createHmac('sha256', secret).update('ABC234:u_abcdefghij').digest('base64url');
    expect(signSessionKey(secret, 'ABC234', 'u_abcdefghij')).toBe(expected);
  });

  it('verifica apenas o par correto', () => {
    const key = signSessionKey(secret, 'ABC234', 'u_abcdefghij');
    expect(verifySessionKey(secret, 'ABC234', 'u_abcdefghij', key)).toBe(true);
    expect(verifySessionKey(secret, 'ABC235', 'u_abcdefghij', key)).toBe(false);
    expect(verifySessionKey(secret, 'ABC234', 'u_abcdefghik', key)).toBe(false);
    expect(verifySessionKey('outro', 'ABC234', 'u_abcdefghij', key)).toBe(false);
    expect(verifySessionKey(secret, 'ABC234', 'u_abcdefghij', key.slice(1))).toBe(false);
    expect(verifySessionKey(secret, 'ABC234', 'u_abcdefghij', '')).toBe(false);
  });

  it('lê o Bearer do header', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer  abc ')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});
