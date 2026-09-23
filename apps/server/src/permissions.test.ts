import { TokenVerifier } from 'livekit-server-sdk';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { SCREEN_SOURCES } from './livekit.js';
import { RoomManager } from './rooms.js';
import { FakeRoomApi, testConfig } from './testing.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const json = (res: Response): Promise<Json> => res.json();

async function setup(env: Record<string, string> = {}) {
  const config = testConfig(env);
  const api = new FakeRoomApi();
  const rooms = new RoomManager(config, api);
  const app = createApp({ config, rooms });
  const post = (path: string, body: unknown, sessionKey?: string) =>
    app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sessionKey && { Authorization: `Bearer ${sessionKey}` }) },
      body: JSON.stringify(body),
    });

  const host = await json(await post('/api/rooms', { nickname: 'Host' }));
  api.connect(host.code, host.identity, host.name, true);
  const code: string = host.code;

  async function guest(nickname: string) {
    const g = await json(await post(`/api/rooms/${code}/join`, { nickname }));
    api.connect(code, g.identity, g.name);
    return g;
  }
  const grant = (target: string, canShare = true, as = host) =>
    post(`/api/rooms/${code}/permissions`, { identity: as.identity, targetIdentity: target, canShare }, as.sessionKey);
  const kick = (target: string, as = host) =>
    post(`/api/rooms/${code}/kick`, { identity: as.identity, targetIdentity: target }, as.sessionKey);
  const rejoin = (g: Json) => post(`/api/rooms/${code}/rejoin`, { identity: g.identity, name: g.name }, g.sessionKey);

  return { config, api, rooms, post, host, code, guest, grant, kick, rejoin };
}

describe('verificação de host', () => {
  it('convidado não pode conceder permissão (403 NOT_HOST)', async () => {
    const { guest, grant } = await setup();
    const a = await guest('Ana');
    const b = await guest('Bia');
    const res = await grant(b.identity, true, a);
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe('NOT_HOST');
  });

  it('sessionKey de outra identity é recusado (401)', async () => {
    const { guest, code, post, host } = await setup();
    const a = await guest('Ana');
    const res = await post(
      `/api/rooms/${code}/permissions`,
      { identity: host.identity, targetIdentity: a.identity, canShare: true },
      a.sessionKey,
    );
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe('UNAUTHORIZED');
  });

  it('host é quem está na metadata atual, não quem criou a sala', async () => {
    const { guest, grant, api, code, host } = await setup();
    const a = await guest('Ana');
    const b = await guest('Bia');
    await api.updateRoomMetadata(code, JSON.stringify({ hostIdentity: a.identity, createdAt: 1 }));
    expect((await grant(b.identity, true, host)).status).toBe(403);
    expect((await grant(b.identity, true, a)).status).toBe(204);
  });
});

describe('permissão de tela', () => {
  it('conceder e revogar atualiza o LiveKit na hora', async () => {
    const { guest, grant, api, code } = await setup();
    const a = await guest('Ana');

    expect((await grant(a.identity)).status).toBe(204);
    let perm = api.permissionOf(code, a.identity)!;
    expect(perm.canPublish).toBe(true);
    expect(perm.canPublishSources).toEqual(SCREEN_SOURCES);
    expect(perm.canSubscribe).toBe(true);
    expect(perm.canPublishData).toBe(true);

    expect((await grant(a.identity, false)).status).toBe(204);
    perm = api.permissionOf(code, a.identity)!;
    expect(perm.canPublish).toBe(false);
    expect(perm.canPublishSources).toEqual([]);
    expect(perm.canPublishData).toBe(true);
  });

  it('permissão sobrevive a um reload (rejoin)', async () => {
    const { config, guest, grant, rejoin } = await setup();
    const verifier = new TokenVerifier(config.livekit.apiKey, config.livekit.apiSecret);
    const a = await guest('Ana');
    await grant(a.identity);
    const claims = await verifier.verify((await json(await rejoin(a))).token);
    expect(claims.video).toMatchObject({ canPublish: true, canPublishSources: ['screen_share', 'screen_share_audio'] });

    await grant(a.identity, false);
    const claims2 = await verifier.verify((await json(await rejoin(a))).token);
    expect(claims2.video).toMatchObject({ canPublish: false });
  });

  it('limite de telas conta o host (padrão 4 = host + 3)', async () => {
    const { guest, grant } = await setup();
    const gs = [await guest('A1'), await guest('A2'), await guest('A3'), await guest('A4')];
    for (const g of gs.slice(0, 3)) expect((await grant(g.identity)).status).toBe(204);

    const res = await grant(gs[3].identity);
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe('SCREEN_LIMIT');

    // Conceder de novo a quem já tem não conta como vaga extra.
    expect((await grant(gs[0].identity)).status).toBe(204);
    // Revogar libera vaga.
    await grant(gs[0].identity, false);
    expect((await grant(gs[3].identity)).status).toBe(204);
  });

  it('limite configurável por MAX_SHARERS', async () => {
    const { guest, grant } = await setup({ MAX_SHARERS: '2' });
    const a = await guest('Ana');
    const b = await guest('Bia');
    expect((await grant(a.identity)).status).toBe(204);
    expect((await grant(b.identity)).status).toBe(409);
  });

  it('quem saiu não ocupa vaga; ao voltar sem vaga, perde a permissão', async () => {
    const { guest, grant, api, code, rejoin, config } = await setup({ MAX_SHARERS: '2' });
    const verifier = new TokenVerifier(config.livekit.apiKey, config.livekit.apiSecret);
    const a = await guest('Ana');
    const b = await guest('Bia');
    await grant(a.identity);
    api.disconnect(code, a.identity);
    expect((await grant(b.identity)).status).toBe(204);

    const claims = await verifier.verify((await json(await rejoin(a))).token);
    expect(claims.video).toMatchObject({ canPublish: false });
  });

  it('participante inexistente dá 404 e o host não altera a própria permissão', async () => {
    const { grant, host } = await setup();
    const res = await grant('u_0000000000');
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe('PARTICIPANT_NOT_FOUND');
    expect((await grant(host.identity, false)).status).toBe(400);
  });
});

describe('kick', () => {
  it('remove do LiveKit e bloqueia o rejoin', async () => {
    const { guest, kick, api, code, rejoin } = await setup();
    const a = await guest('Ana');
    expect((await kick(a.identity)).status).toBe(204);
    expect(api.permissionOf(code, a.identity)).toBeUndefined();

    const res = await rejoin(a);
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe('KICKED');
  });

  it('libera a vaga de tela de quem foi removido', async () => {
    const { guest, grant, kick, rooms, code } = await setup({ MAX_SHARERS: '2' });
    const a = await guest('Ana');
    const b = await guest('Bia');
    await grant(a.identity);
    await kick(a.identity);
    expect(rooms.store.get(code)!.sharers.has(a.identity)).toBe(false);
    expect((await grant(b.identity)).status).toBe(204);
  });

  it('só o host remove, e não a si mesmo', async () => {
    const { guest, kick, host } = await setup();
    const a = await guest('Ana');
    const b = await guest('Bia');
    expect((await kick(b.identity, a)).status).toBe(403);
    expect((await kick(host.identity)).status).toBe(400);
    expect((await kick('u_0000000000')).status).toBe(404);
  });
});
