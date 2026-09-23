import type { RoomMetadata } from '@telinha/shared';
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  type ParticipantPermission,
  type VideoGrant,
} from 'livekit-server-sdk';
import type { Config } from './config.js';

/** Subconjunto do RoomServiceClient usado pelo app (facilita testar com um fake). */
export type RoomApi = Pick<
  RoomServiceClient,
  | 'createRoom'
  | 'listRooms'
  | 'listParticipants'
  | 'updateParticipant'
  | 'updateRoomMetadata'
  | 'removeParticipant'
>;

export function createRoomApi(config: Config): RoomApi {
  // O RoomServiceClient fala HTTP; o LIVEKIT_URL normalmente é wss://.
  const httpUrl = config.livekit.url.replace(/^ws(s?):\/\//, 'http$1://');
  return new RoomServiceClient(httpUrl, config.livekit.apiKey, config.livekit.apiSecret);
}

export type Role = 'host' | 'sharer' | 'viewer';

export const SCREEN_SOURCES = [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];

export function grantsFor(role: Role, room: string): VideoGrant {
  const base: VideoGrant = {
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
  };
  switch (role) {
    case 'host':
      return { ...base, canPublish: true, canPublishSources: SCREEN_SOURCES, roomAdmin: true };
    case 'sharer':
      return { ...base, canPublish: true, canPublishSources: SCREEN_SOURCES };
    case 'viewer':
      return { ...base, canPublish: false, canPublishSources: [] };
  }
}

/**
 * Permissão aplicada via updateParticipant. O LiveKit substitui a permissão inteira,
 * então todos os campos relevantes são enviados.
 */
export function permissionFor(canShare: boolean): Partial<ParticipantPermission> {
  return {
    canSubscribe: true,
    canPublishData: true,
    canPublish: canShare,
    canPublishSources: canShare ? SCREEN_SOURCES : [],
    canUpdateMetadata: false,
  };
}

export function hasScreenPermission(permission: ParticipantPermission | undefined): boolean {
  return !!permission?.canPublish && permission.canPublishSources.includes(TrackSource.SCREEN_SHARE);
}

export const TOKEN_TTL = '10m';

export async function createToken(
  config: Config,
  opts: { room: string; identity: string; name: string; role: Role },
): Promise<string> {
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: opts.identity,
    name: opts.name,
    ttl: TOKEN_TTL,
  });
  at.addGrant(grantsFor(opts.role, opts.room));
  return at.toJwt();
}

export function serializeMetadata(meta: RoomMetadata): string {
  return JSON.stringify(meta);
}
