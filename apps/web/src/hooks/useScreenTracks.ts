import { useTracks, type TrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';

/** Todas as telas publicadas na sala (inclusive a local). */
export function useScreenTracks(): TrackReference[] {
  return useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
}
