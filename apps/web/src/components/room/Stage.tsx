import { AudioTrack, VideoTrack, useAudioPlayback, useTracks, type TrackReference } from '@livekit/components-react';
import { RemoteTrackPublication, Track, VideoQuality } from 'livekit-client';
import { useEffect } from 'react';
import { useCanShare } from '../../hooks/useCanShare';
import { canCaptureScreen } from '../../lib/media';
import { ScreenShareIcon } from '../icons';
import { Button } from '../ui';

/**
 * Tela em destaque na qualidade máxima.
 *
 * A tela é publicada com simulcast desligado e codec sem SVC (H.264/VP8): existe uma única
 * camada, então o SFU não tem versão menor para mandar e o adaptiveStream não consegue reduzir a
 * resolução pelo tamanho do elemento (ele só pausa telas que não estão visíveis). Além disso,
 * pedimos explicitamente a qualidade HIGH para a tela em destaque.
 */
function useMaxQuality(trackRef: TrackReference | undefined) {
  const publication = trackRef?.publication;
  useEffect(() => {
    if (publication instanceof RemoteTrackPublication && publication.isSubscribed) {
      publication.setVideoQuality(VideoQuality.HIGH);
    }
  }, [publication, publication?.isSubscribed]);
}

const displayName = (t: TrackReference) => t.participant.name || t.participant.identity;

export function Stage({
  screens,
  focused,
  onSelect,
}: {
  screens: TrackReference[];
  focused: TrackReference | undefined;
  onSelect: (identity: string) => void;
}) {
  const canShare = useCanShare();
  useMaxQuality(focused);

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

  return (
    <div className="flex h-full flex-col">
      <figure className="relative min-h-0 flex-1">
        <VideoTrack trackRef={focused} className="h-full w-full object-contain" muted />
        <figcaption className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
          {focused.participant.isLocal ? 'Você está transmitindo' : `Tela de ${displayName(focused)}`}
        </figcaption>
        <FocusedScreenAudio focusedIdentity={focused.participant.identity} />
      </figure>

      {screens.length >= 2 && (
        <ScreenStrip screens={screens} focusedIdentity={focused.participant.identity} onSelect={onSelect} />
      )}
    </div>
  );
}

/**
 * Miniaturas de todas as telas no ar. Telas remotas fora de destaque não renderizam vídeo:
 * sem elemento visível, o adaptiveStream pausa o envio delas e ninguém decodifica 1080p à toa.
 * A própria tela (prévia local) não custa rede, então aparece em vídeo.
 */
function ScreenStrip({
  screens,
  focusedIdentity,
  onSelect,
}: {
  screens: TrackReference[];
  focusedIdentity: string;
  onSelect: (identity: string) => void;
}) {
  return (
    <div role="group" aria-label="Telas no ar" className="flex gap-2 overflow-x-auto border-t border-border bg-bg/90 p-2">
      {screens.map((t) => {
        const active = t.participant.identity === focusedIdentity;
        const label = t.participant.isLocal ? 'Sua tela' : `Tela de ${displayName(t)}`;
        const target = t.participant.isLocal ? 'sua tela' : `a tela de ${displayName(t)}`;
        return (
          <button
            key={t.participant.identity}
            type="button"
            onClick={() => onSelect(t.participant.identity)}
            aria-pressed={active}
            aria-label={active ? `${label} (em destaque)` : `Destacar ${target}`}
            className={`relative flex h-20 w-36 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border text-xs transition-colors ${
              active ? 'border-accent bg-accent/15 text-fg' : 'border-border bg-surface text-muted hover:border-muted hover:text-fg'
            }`}
          >
            {t.participant.isLocal && !active ? (
              <VideoTrack trackRef={t} className="absolute inset-0 h-full w-full object-cover opacity-70" muted />
            ) : (
              <ScreenShareIcon className="h-6 w-6" />
            )}
            <span className="relative z-10 max-w-full truncate rounded bg-black/50 px-1.5 py-0.5 text-white">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Toca só o áudio da tela em destaque (várias telas com som ao mesmo tempo vira bagunça). */
function FocusedScreenAudio({ focusedIdentity }: { focusedIdentity: string }) {
  const audioTracks = useTracks([Track.Source.ScreenShareAudio]);
  const { canPlayAudio, startAudio } = useAudioPlayback();
  const track = audioTracks.find((t) => t.participant.identity === focusedIdentity && !t.participant.isLocal);
  if (!track) return null;
  return (
    <>
      <AudioTrack trackRef={track} />
      {!canPlayAudio && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <Button onClick={() => void startAudio()}>Ativar áudio da tela</Button>
        </div>
      )}
    </>
  );
}
