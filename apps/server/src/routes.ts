import {
  createRoomRequestSchema,
  joinRoomRequestSchema,
  kickRequestSchema,
  setPermissionRequestSchema,
  rejoinRoomRequestSchema,
  roomCodeSchema,
} from '@telinha/shared';
import { Hono } from 'hono';
import { requireSession } from './auth.js';
import type { Config } from './config.js';
import type { RoomManager } from './rooms.js';
import { parseParam, readJson } from './validate.js';

export function roomRoutes(config: Config, rooms: RoomManager) {
  const r = new Hono();

  r.post('/', async (c) => {
    const { nickname } = await readJson(c, createRoomRequestSchema);
    return c.json(await rooms.createRoom(nickname), 201);
  });

  r.get('/:code', async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    return c.json(await rooms.getInfo(code));
  });

  r.post('/:code/join', async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    const { nickname } = await readJson(c, joinRoomRequestSchema);
    return c.json(await rooms.join(code, nickname));
  });

  r.post('/:code/rejoin', async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    const { identity, name } = await readJson(c, rejoinRoomRequestSchema);
    requireSession(c, config, code, identity);
    return c.json(await rooms.rejoin(code, identity, name));
  });

  r.post('/:code/permissions', async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    const { identity, targetIdentity, canShare } = await readJson(c, setPermissionRequestSchema);
    requireSession(c, config, code, identity);
    await rooms.setPermission(code, identity, targetIdentity, canShare);
    return c.body(null, 204);
  });

  r.post('/:code/kick', async (c) => {
    const code = parseParam(roomCodeSchema, c.req.param('code'));
    const { identity, targetIdentity } = await readJson(c, kickRequestSchema);
    requireSession(c, config, code, identity);
    await rooms.kick(code, identity, targetIdentity);
    return c.body(null, 204);
  });

  return r;
}
