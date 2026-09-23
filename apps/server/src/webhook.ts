import { Hono } from 'hono';
import { WebhookReceiver } from 'livekit-server-sdk';
import type { Config } from './config.js';
import { ApiError } from './errors.js';
import type { RoomManager } from './rooms.js';

/** POST /api/livekit/webhook — valida a assinatura do LiveKit sobre o corpo cru. */
export function webhookRoutes(config: Config, rooms: RoomManager) {
  const receiver = new WebhookReceiver(config.livekit.apiKey, config.livekit.apiSecret);
  const r = new Hono();

  r.post('/webhook', async (c) => {
    const body = await c.req.text();
    let event;
    try {
      event = await receiver.receive(body, c.req.header('Authorization'));
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'Webhook com assinatura inválida.');
    }

    const code = event.room?.name;
    switch (event.event) {
      case 'participant_left':
        if (code && event.participant) rooms.handleParticipantLeft(code, event.participant.identity, event.room?.metadata);
        break;
      case 'room_finished':
        if (code) rooms.handleRoomFinished(code);
        break;
      default:
        break;
    }
    return c.json({ ok: true });
  });

  return r;
}
