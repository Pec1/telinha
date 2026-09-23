import { useLocalParticipantPermissions } from '@livekit/components-react';

/** Valor de TrackSource.SCREEN_SHARE no protocolo do LiveKit (@livekit/protocol). */
export const PROTO_SOURCE_SCREEN_SHARE = 3;

/** Permissão de tela, sempre vinda do LiveKit (ParticipantPermissionsChanged). */
export function useCanShare(): boolean {
  const permissions = useLocalParticipantPermissions();
  return !!permissions?.canPublish && permissions.canPublishSources.includes(PROTO_SOURCE_SCREEN_SHARE);
}
