import {
  createRoomRequestSchema,
  joinRoomRequestSchema,
  hostCheckRequestSchema,
  kickRequestSchema,
  setPermissionRequestSchema,
  rejoinRoomRequestSchema,
  roomCodeSchema,
} from '@telinha/shared';
import { Hono } from 'hono';
import { requireSession } from './auth.js';
import type { Config } from './config.js';
import type { RateLimits } from './rateLimit.js';
import type { RoomManager } from './rooms.js';
import { parseParam, readJson } from './validate.js';

export function roomRoutes(config: Config, rooms: RoomManager, limits: RateLimits) {
  const r = new Hono();

  r.post('/', limits.createRoom, async (c) => {
    const { nickname } = await readJson(c, createRoomRequestSchema);
    return c.json(await rooms.createRoom(nickname), 201);
  });

  r.get('/:code', limits.entry, async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    return c.json(await rooms.getInfo(code));
  });

  r.post('/:code/join', limits.entry, async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    const { nickname } = await readJson(c, joinRoomRequestSchema);
    return c.json(await rooms.join(code, nickname));
  });

  r.post('/:code/rejoin', limits.entry, async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    const { identity, name } = await readJson(c, rejoinRoomRequestSchema);
    requireSession(c, config, code, identity);
    return c.json(await rooms.rejoin(code, identity, name));
  });

  r.post('/:code/permissions', limits.hostAction, async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    const { identity, targetIdentity, canShare } = await readJson(c, setPermissionRequestSchema);
    requireSession(c, config, code, identity);
    await rooms.setPermission(code, identity, targetIdentity, canShare);
    return c.body(null, 204);
  });

  r.post('/:code/kick', limits.hostAction, async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    const { identity, targetIdentity } = await readJson(c, kickRequestSchema);
    requireSession(c, config, code, identity);
    await rooms.kick(code, identity, targetIdentity);
    return c.body(null, 204);
  });

  // Fallback da sucessão: um participante avisa que o host sumiu (caso o webhook não chegue).
  r.post('/:code/host-check', limits.entry, async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    const { identity } = await readJson(c, hostCheckRequestSchema);
    requireSession(c, config, code, identity);
    await rooms.reportHostMissing(code, identity);
    return c.body(null, 204);
  });

  return r;
}
