import type { HealthResponse } from '@telinha/shared';
import { Hono } from 'hono';
import type { Config } from './config.js';
import { onError, onNotFound } from './errors.js';
import { createRateLimits } from './rateLimit.js';
import type { RoomManager } from './rooms.js';
import { roomRoutes } from './routes.js';
import { mountFrontend } from './static.js';
import { webhookRoutes } from './webhook.js';

export interface AppDeps {
  config: Config;
  rooms: RoomManager;
  /** Pasta do build do frontend; só é servida em produção. */
  webDist?: string;
}

export function createApp({ config, rooms, webDist }: AppDeps) {
  const app = new Hono();

  app.onError(onError);
  app.notFound(onNotFound);

  app.get('/health', (c) => c.json<HealthResponse>({ ok: true }));

  const api = new Hono();
  api.route('/rooms', roomRoutes(config, rooms, createRateLimits(config)));
  api.route('/livekit', webhookRoutes(config, rooms));
  app.route('/api', api);

  if (config.isProduction) mountFrontend(app, webDist);

  return app;
}
