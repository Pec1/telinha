import { VideoTrack, type TrackReference } from '@livekit/components-react';
import { useCanShare } from '../../hooks/useCanShare';
import { canCaptureScreen } from '../../lib/media';
import { ScreenShareIcon } from '../icons';

export function Stage({ focused }: { focused: TrackReference | undefined }) {
  const canShare = useCanShare();

  if (!focused) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted">
        <ScreenShareIcon className="h-12 w-12 opacity-40" />
        <p className="text-lg text-fg">Ninguém está transmitindo agora</p>
        <p className="max-w-sm text-sm">
          {canShare && canCaptureScreen()
            ? 'Clique em “Compartilhar tela” na barra abaixo para começar.'
            : 'Quando alguém compartilhar a tela, ela aparece aqui.'}
        </p>
      </div>
    );
  }

  const isLocal = focused.participant.isLocal;
  return (
    <figure className="relative h-full w-full">
      <VideoTrack
        trackRef={focused}
        className="h-full w-full object-contain"
        // Prévia local sem áudio para não haver eco.
        muted
      />
      <figcaption className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        {isLocal ? 'Você está transmitindo' : `Tela de ${focused.participant.name || focused.participant.identity}`}
      </figcaption>
    </figure>
  );
}
