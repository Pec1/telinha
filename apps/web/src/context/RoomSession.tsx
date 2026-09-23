import { createContext, useContext } from 'react';
import type { StoredSession } from '../lib/session';

export const RoomSessionContext = createContext<StoredSession | null>(null);

export function useRoomSession(): StoredSession {
  const session = useContext(RoomSessionContext);
  if (!session) throw new Error('useRoomSession fora de RoomSessionContext');
  return session;
}
