import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createRoomApi } from './livekit.js';
import { RoomManager } from './rooms.js';

const config = loadConfig();
const rooms = new RoomManager(config, createRoomApi(config));
const app = createApp({ config, rooms });

const server = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  console.log(`Telinha server ouvindo em http://localhost:${info.port} (${config.isProduction ? 'produção' : 'dev'})`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
