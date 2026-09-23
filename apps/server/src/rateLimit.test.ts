import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { RoomManager } from './rooms.js';
import { FakeRoomApi, testConfig } from './testing.js';

function setup(env: Record<string, string> = {}) {
  const config = testConfig(env);
  const app = createApp({ config, rooms: new RoomManager(config, new FakeRoomApi()) });
  const create = (ip: string) =>
    app.request('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `${ip}, 10.0.0.1` },
      body: JSON.stringify({ nickname: 'Ana' }),
    });
  const get = (ip: string) => app.request('/api/rooms/ABCDEF', { headers: { 'X-Forwarded-For': ip } });
  return { app, create, get };
}

describe('rate limit por IP', () => {
  it('criar sala: 5 a cada 10 minutos, por IP do X-Forwarded-For', async () => {
    const { create } = setup();
    for (let i = 0; i < 5; i++) expect((await create('1.1.1.1')).status).toBe(201);
    const res = await create('1.1.1.1');
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: { code: 'RATE_LIMITED', message: expect.any(String) } });
    expect(res.headers.get('retry-after')).toBeTruthy();
    // Outro IP não é afetado.
    expect((await create('2.2.2.2')).status).toBe(201);
  });

  it('GET da sala: 30 por minuto', async () => {
    const { get } = setup();
    for (let i = 0; i < 30; i++) expect((await get('3.3.3.3')).status).toBe(200);
    expect((await get('3.3.3.3')).status).toBe(429);
  });

  it('/health não tem limite e RATE_LIMIT=off desliga tudo', async () => {
    const { app } = setup();
    for (let i = 0; i < 50; i++) expect((await app.request('/health')).status).toBe(200);
    const off = setup({ RATE_LIMIT: 'off' });
    for (let i = 0; i < 8; i++) expect((await off.create('4.4.4.4')).status).toBe(201);
  });
});
