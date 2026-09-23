import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOM_CODE_ALPHABET } from '@telinha/shared';
import { TokenVerifier, TrackSource } from 'livekit-server-sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { RoomManager } from './rooms.js';
import { FakeRoomApi, testConfig } from './testing.js';

const config = testConfig();
const verifier = new TokenVerifier(config.livekit.apiKey, config.livekit.apiSecret);

function setup(cfg = config) {
  const api = new FakeRoomApi();
  const rooms = new RoomManager(cfg, api);
  const app = createApp({ config: cfg, rooms });
  const post = (path: string, body: unknown, sessionKey?: string) =>
    app.request(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionKey ? { Authorization: `Bearer ${sessionKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
  return { api, rooms, app, post };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const json = (res: Response): Promise<Json> => res.json();

describe('básico', () => {
  const { app } = setup();

  it('GET /health responde ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
  });

  it('rotas desconhecidas devolvem erro padronizado', async () => {
    const res = await app.request('/api/nada');
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('JSON inválido vira INVALID_INPUT', async () => {
    const res = await app.request('/api/rooms', { method: 'POST', body: 'x' });
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe('INVALID_INPUT');
  });
});

describe('POST /api/rooms', () => {
  it('cria sala com código válido, metadata e token de host', async () => {
    const { post, api } = setup();
    const res = await post('/api/rooms', { nickname: '  Ana ' });
    expect(res.status).toBe(201);
    const body = await json(res);

    expect(body.code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{6}$`));
    expect(body.identity).toMatch(/^u_[A-Za-z0-9_-]{10}$/);
    expect(body.name).toBe('Ana');
    expect(body.url).toBe(config.livekit.url);
    expect(body.sessionKey).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const room = api.rooms.get(body.code)!.room;
    expect(JSON.parse(room.metadata)).toEqual({ hostIdentity: body.identity, createdAt: expect.any(Number) });
    expect(room.emptyTimeout).toBe(300);
    expect(room.maxParticipants).toBe(25);

    const claims = await verifier.verify(body.token);
    expect(claims.sub).toBe(body.identity);
    expect(claims.name).toBe('Ana');
    expect(claims.video).toMatchObject({
      room: body.code,
      roomJoin: true,
      canSubscribe: true,
      canPublishData: true,
      canPublish: true,
      roomAdmin: true,
    });
    expect(claims.video?.canPublishSources).toEqual(['screen_share', 'screen_share_audio']);
    // TTL curto: 10 minutos.
    expect(claims.exp! - claims.nbf!).toBe(600);
  });

  it('valida o nickname', async () => {
    const { post } = setup();
    const res = await post('/api/rooms', { nickname: 'A' });
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe('INVALID_INPUT');
  });
});

describe('GET /api/rooms/:code e join', () => {
  it('informa sala inexistente', async () => {
    const { app } = setup();
    const res = await app.request('/api/rooms/ABCDEF');
    expect(await json(res)).toEqual({ exists: false, participants: 0, full: false });
  });

  it('join devolve token de convidado sem publicação', async () => {
    const { post, api } = setup();
    const { code, identity } = await json(await post('/api/rooms', { nickname: 'Ana' }));
    api.connect(code, identity, 'Ana', true);

    const res = await post(`/api/rooms/${code.toLowerCase()}/join`, { nickname: 'Bia' });
    expect(res.status).toBe(200);
    const body = await json(res);
    const claims = await verifier.verify(body.token);
    expect(claims.video).toMatchObject({ canSubscribe: true, canPublishData: true, canPublish: false });
    expect(claims.video?.roomAdmin).toBeUndefined();
  });

  it('nickname repetido ganha sufixo', async () => {
    const { post, api } = setup();
    const { code, identity } = await json(await post('/api/rooms', { nickname: 'Ana' }));
    api.connect(code, identity, 'Ana');

    const b = await json(await post(`/api/rooms/${code}/join`, { nickname: 'ana' }));
    expect(b.name).toBe('ana (2)');
    api.connect(code, b.identity, b.name);
    const c = await json(await post(`/api/rooms/${code}/join`, { nickname: 'Ana' }));
    expect(c.name).toBe('Ana (3)');
  });

  it('404 para sala inexistente e 409 para sala cheia', async () => {
    const cfg = testConfig({ MAX_PARTICIPANTS: '2' });
    const { post, api, app } = setup(cfg);
    expect((await post('/api/rooms/ABCDEF/join', { nickname: 'Bia' })).status).toBe(404);

    const { code, identity } = await json(await post('/api/rooms', { nickname: 'Ana' }));
    api.connect(code, identity, 'Ana');
    api.connect(code, 'u_xxxxxxxxxx', 'Bia');
    const res = await post(`/api/rooms/${code}/join`, { nickname: 'Caio' });
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe('ROOM_FULL');
    expect(await json(await app.request(`/api/rooms/${code}`))).toEqual({ exists: true, participants: 2, full: true });
  });
});

describe('rejoin', () => {
  it('exige sessionKey válido', async () => {
    const { post } = setup();
    const { code, identity, name } = await json(await post('/api/rooms', { nickname: 'Ana' }));
    expect((await post(`/api/rooms/${code}/rejoin`, { identity, name })).status).toBe(401);
    expect((await post(`/api/rooms/${code}/rejoin`, { identity, name }, 'errado')).status).toBe(401);
  });

  it('host volta como host', async () => {
    const { post } = setup();
    const created = await json(await post('/api/rooms', { nickname: 'Ana' }));
    const res = await post(
      `/api/rooms/${created.code}/rejoin`,
      { identity: created.identity, name: created.name },
      created.sessionKey,
    );
    expect(res.status).toBe(200);
    const claims = await verifier.verify((await json(res)).token);
    expect(claims.sub).toBe(created.identity);
    expect(claims.video).toMatchObject({ canPublish: true, roomAdmin: true });
  });

  it('reconstrói permissões a partir do LiveKit quando o server não conhece a sala', async () => {
    const { post, api } = setup();
    const created = await json(await post('/api/rooms', { nickname: 'Ana' }));
    const guest = await json(await post(`/api/rooms/${created.code}/join`, { nickname: 'Bia' }));
    api.connect(created.code, guest.identity, guest.name, true);

    // Novo server (ex: reiniciou) falando com o mesmo LiveKit.
    const rooms2 = new RoomManager(config, api);
    const app2 = createApp({ config, rooms: rooms2 });
    const res = await app2.request(`/api/rooms/${created.code}/rejoin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guest.sessionKey}` },
      body: JSON.stringify({ identity: guest.identity, name: guest.name }),
    });
    expect(res.status).toBe(200);
    const claims = await verifier.verify((await json(res)).token);
    expect(claims.video).toMatchObject({ canPublish: true });
    expect(claims.video?.roomAdmin).toBeUndefined();
    expect(TrackSource.SCREEN_SHARE).toBe(3);
  });

  it('removido recebe 403 KICKED', async () => {
    const { post, rooms } = setup();
    const created = await json(await post('/api/rooms', { nickname: 'Ana' }));
    const guest = await json(await post(`/api/rooms/${created.code}/join`, { nickname: 'Bia' }));
    rooms.store.get(created.code)!.kicked.add(guest.identity);
    const res = await post(`/api/rooms/${created.code}/rejoin`, { identity: guest.identity, name: guest.name }, guest.sessionKey);
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe('KICKED');
  });
});

describe('frontend em produção', () => {
  const dist = mkdtempSync(join(tmpdir(), 'telinha-web-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Telinha</title>');
  writeFileSync(join(dist, 'assets', 'app-abc.js'), 'console.log(1)');

  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    const cfg = { ...config, isProduction: true };
    app = createApp({ config: cfg, rooms: new RoomManager(cfg, new FakeRoomApi()), webDist: dist });
  });

  it('serve assets com cache longo', async () => {
    const res = await app.request('/assets/app-abc.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('immutable');
  });

  it('rotas do SPA caem no index.html', async () => {
    for (const path of ['/', '/s/ABC234']) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('<title>Telinha</title>');
    }
  });

  it('API desconhecida continua devolvendo JSON 404', async () => {
    const res = await app.request('/api/nada');
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe('NOT_FOUND');
  });
});

describe('config', () => {
  it('aplica os padrões', () => {
    expect(config.maxParticipants).toBe(25);
    expect(config.maxSharers).toBe(4);
    expect(config.emptyTimeoutSeconds).toBe(300);
    expect(config.hostGraceSeconds).toBe(20);
    expect(config.port).toBe(8787);
  });

  it('falha com variáveis ausentes', () => {
    expect(() => loadConfig({})).toThrow(/LIVEKIT_URL/);
  });
});
