import { useLocalParticipant, useRoomInfo } from '@livekit/components-react';
import { parseRoomMetadata } from '@telinha/shared';
import { useMemo } from 'react';

/** hostIdentity atual, sempre vindo da metadata da sala (RoomMetadataChanged). */
export function useHostIdentity(): string | null {
  const { metadata } = useRoomInfo();
  return useMemo(() => parseRoomMetadata(metadata)?.hostIdentity ?? null, [metadata]);
}

export function useIsHost(): boolean {
  const hostIdentity = useHostIdentity();
  const { localParticipant } = useLocalParticipant();
  return hostIdentity !== null && hostIdentity === localParticipant.identity;
}
