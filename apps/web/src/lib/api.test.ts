import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiRequest } from './api';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('envia JSON e o sessionKey como Bearer', async () => {
    const fetchFn = mockFetch(200, { ok: true });
    await apiRequest('/api/x', { body: { a: 1 }, sessionKey: 'k' });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/x');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
  });

  it('converte o erro padronizado em ApiRequestError', async () => {
    mockFetch(409, { error: { code: 'ROOM_FULL', message: 'A sala está cheia.' } });
    await expect(apiRequest('/api/x')).rejects.toMatchObject({ status: 409, code: 'ROOM_FULL' });
  });

  it('falha de rede vira código NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    await expect(apiRequest('/api/x')).rejects.toBeInstanceOf(ApiRequestError);
  });
});
