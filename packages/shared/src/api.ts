import { z } from 'zod';
import { displayNameSchema, identitySchema, nicknameSchema } from './schemas.js';

// ---- Requests ----

export const createRoomRequestSchema = z.object({ nickname: nicknameSchema });
export type CreateRoomRequest = z.input<typeof createRoomRequestSchema>;

export const joinRoomRequestSchema = z.object({ nickname: nicknameSchema });
export type JoinRoomRequest = z.input<typeof joinRoomRequestSchema>;

export const rejoinRoomRequestSchema = z.object({
  identity: identitySchema,
  // O name aqui é o que o próprio backend atribuiu (pode ter sufixo " (2)").
  name: displayNameSchema,
});
export type RejoinRoomRequest = z.input<typeof rejoinRoomRequestSchema>;

export const setPermissionRequestSchema = z.object({
  identity: identitySchema,
  targetIdentity: identitySchema,
  canShare: z.boolean(),
});
export type SetPermissionRequest = z.input<typeof setPermissionRequestSchema>;

export const kickRequestSchema = z.object({
  identity: identitySchema,
  targetIdentity: identitySchema,
});
export type KickRequest = z.input<typeof kickRequestSchema>;

// ---- Responses ----

export interface SessionCredentials {
  identity: string;
  name: string;
  sessionKey: string;
}

export interface LiveKitConnection {
  token: string;
  url: string;
}

export interface CreateRoomResponse extends SessionCredentials, LiveKitConnection {
  code: string;
}

export type JoinRoomResponse = SessionCredentials & LiveKitConnection;

export type RejoinRoomResponse = LiveKitConnection;

export interface RoomInfoResponse {
  exists: boolean;
  participants: number;
  full: boolean;
}

export interface HealthResponse {
  ok: true;
}
