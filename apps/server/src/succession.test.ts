import { createHash } from 'node:crypto';
import { AccessToken, TokenVerifier } from 'livekit-server-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { RoomManager } from './rooms.js';
import { FakeRoomApi, testConfig } from './testing.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const json = (res: Response): Promise<Json> => res.json();

async function setup() {
  const config = testConfig();
  const api = new FakeRoomApi();
  const rooms = new RoomManager(config, api);
  const app = createApp({ config, rooms });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  const host = await json(await post('/api/rooms', { nickname: 'Host' }));
  const code: string = host.code;
  api.connect(code, host.identity, host.name, true);
  const guest = async (nickname: string) => {
    const g = await json(await post(`/api/rooms/${code}/join`, { nickname }));
    api.connect(code, g.identity, g.name);
    return g;
  };
  const metadata = () => JSON.parse(api.rooms.get(code)!.room.metadata);
  return { config, api, rooms, app, post, host, code, guest, metadata };
}

/** Assina um corpo de webhook como o LiveKit faz (JWT com sha256 do corpo). */
async function signWebhook(config: ReturnType<typeof testConfig>, body: string) {
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret);
  at.sha256 = createHash('sha256').update(body).digest('base64');
  return at.toJwt();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('sucessão de host', () => {
  it('não promove durante a carência e cancela se o host voltar', async () => {
    const { api, rooms, host, code, guest, metadata } = await setup();
    await guest('Ana');
    api.disconnect(code, host.identity);
    rooms.handleParticipantLeft(code, host.identity, api.rooms.get(code)!.room.metadata);

    await vi.advanceTimersByTimeAsync(19_000);
    expect(metadata().hostIdentity).toBe(host.identity);

    api.connect(code, host.identity, host.name, true); // reload terminou
    await vi.advanceTimersByTimeAsync(1_000);
    expect(metadata().hostIdentity).toBe(host.identity);
    expect(rooms.hasPendingHostCheck(code)).toBe(false);
  });

  it('promove o conectado há mais tempo e dá grants de host', async () => {
    const { api, rooms, host, code, guest, metadata, config, post } = await setup();
    const ana = await guest('Ana');
    await guest('Bia');
    const createdAt = metadata().createdAt;

    api.disconnect(code, host.identity);
    rooms.handleParticipantLeft(code, host.identity, api.rooms.get(code)!.room.metadata);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(metadata()).toEqual({ hostIdentity: ana.identity, createdAt });
    expect(api.permissionOf(code, ana.identity)!.canPublish).toBe(true);

    // Novo host consegue agir como host; o antigo, ao voltar, não.
    const bia = [...api.rooms.get(code)!.participants.values()].find((p) => p.name === 'Bia')!;
    const asAna = await post(
      `/api/rooms/${code}/permissions`,
      { identity: ana.identity, targetIdentity: bia.identity, canShare: true },
      { Authorization: `Bearer ${ana.sessionKey}` },
    );
    expect(asAna.status).toBe(204);

    const verifier = new TokenVerifier(config.livekit.apiKey, config.livekit.apiSecret);
    const oldHost = await json(
      await post(`/api/rooms/${code}/rejoin`, { identity: host.identity, name: host.name }, { Authorization: `Bearer ${host.sessionKey}` }),
    );
    const claims = await verifier.verify(oldHost.token);
    expect(claims.video?.roomAdmin).toBeUndefined();
    expect(claims.video?.canPublish).toBe(false);

    const anaRejoin = await json(
      await post(`/api/rooms/${code}/rejoin`, { identity: ana.identity, name: ana.name }, { Authorization: `Bearer ${ana.sessionKey}` }),
    );
    expect((await verifier.verify(anaRejoin.token)).video).toMatchObject({ roomAdmin: true, canPublish: true });
  });

  it('novo host que já tinha permissão de tela libera a vaga de convidado', async () => {
    const { api, rooms, host, code, guest } = await setup();
    const ana = await guest('Ana');
    rooms.store.get(code)!.sharers.add(ana.identity);
    api.disconnect(code, host.identity);
    rooms.scheduleHostCheck(code);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(rooms.store.get(code)!.sharers.has(ana.identity)).toBe(false);
  });

  it('sala vazia: não faz nada', async () => {
    const { api, rooms, host, code, metadata } = await setup();
    api.disconnect(code, host.identity);
    rooms.handleParticipantLeft(code, host.identity, undefined);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(metadata().hostIdentity).toBe(host.identity);
  });

  it('saída de convidado não agenda nada', async () => {
    const { api, rooms, code, guest } = await setup();
    const ana = await guest('Ana');
    api.disconnect(code, ana.identity);
    rooms.handleParticipantLeft(code, ana.identity, api.rooms.get(code)!.room.metadata);
    expect(rooms.hasPendingHostCheck(code)).toBe(false);
  });

  it('room_finished limpa estado e checagem pendente', async () => {
    const { api, rooms, host, code } = await setup();
    api.disconnect(code, host.identity);
    rooms.scheduleHostCheck(code);
    rooms.handleRoomFinished(code);
    expect(rooms.hasPendingHostCheck(code)).toBe(false);
    expect(rooms.store.has(code)).toBe(false);
  });
});

describe('POST /api/livekit/webhook', () => {
  it('recusa assinatura inválida', async () => {
    const { app } = await setup();
    const res = await app.request('/api/livekit/webhook', {
      method: 'POST',
      headers: { Authorization: 'x', 'Content-Type': 'application/webhook+json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe('UNAUTHORIZED');
  });

  it('participant_left do host agenda a sucessão; outros eventos respondem 200', async () => {
    const { app, api, rooms, host, code, config } = await setup();
    const send = async (payload: unknown) => {
      const body = JSON.stringify(payload);
      return app.request('/api/livekit/webhook', {
        method: 'POST',
        headers: { Authorization: await signWebhook(config, body), 'Content-Type': 'application/webhook+json' },
        body,
      });
    };

    expect((await send({ event: 'track_published', room: { name: code } })).status).toBe(200);

    api.disconnect(code, host.identity);
    const res = await send({
      event: 'participant_left',
      room: { name: code, metadata: api.rooms.get(code)!.room.metadata },
      participant: { identity: host.identity },
    });
    expect(res.status).toBe(200);
    expect(rooms.hasPendingHostCheck(code)).toBe(true);

    expect((await send({ event: 'room_finished', room: { name: code } })).status).toBe(200);
    expect(rooms.hasPendingHostCheck(code)).toBe(false);
  });
});

describe('POST /host-check (fallback sem webhook)', () => {
  it('agenda só quando o host realmente não está na sala', async () => {
    const { post, api, rooms, host, code, guest } = await setup();
    const ana = await guest('Ana');
    const report = () =>
      post(`/api/rooms/${code}/host-check`, { identity: ana.identity }, { Authorization: `Bearer ${ana.sessionKey}` });

    expect((await report()).status).toBe(204);
    expect(rooms.hasPendingHostCheck(code)).toBe(false);

    api.disconnect(code, host.identity);
    expect((await report()).status).toBe(204);
    expect(rooms.hasPendingHostCheck(code)).toBe(true);
  });
});
