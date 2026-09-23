import type { KickRequest, SetPermissionRequest } from '@telinha/shared';
import { apiRequest } from './api';
import type { StoredSession } from './session';

export function setScreenPermission(session: StoredSession, targetIdentity: string, canShare: boolean) {
  const body: SetPermissionRequest = { identity: session.identity, targetIdentity, canShare };
  return apiRequest<void>(`/api/rooms/${session.code}/permissions`, { body, sessionKey: session.sessionKey });
}

export function kickParticipant(session: StoredSession, targetIdentity: string) {
  const body: KickRequest = { identity: session.identity, targetIdentity };
  return apiRequest<void>(`/api/rooms/${session.code}/kick`, { body, sessionKey: session.sessionKey });
}
