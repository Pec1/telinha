import { AudioPresets, Track, type LocalParticipant } from 'livekit-client';
import { SHARE_PRESETS, displayMediaOptions, screenPublishOptions, screenVideoConstraints, type ShareMode } from './media';

/*
 * A captura é feita aqui (getDisplayMedia + publishTrack) em vez de setScreenShareEnabled(true)
 * porque o livekit-client força 1080p quando não recebe resolução, o que impediria o modo Ultra
 * (resolução nativa a 60 fps). Parar continua sendo setScreenShareEnabled(false), que despublica
 * vídeo e áudio da tela; se a pessoa parar pelo botão do navegador, o LiveKit despublica sozinho.
 */

export async function startScreenShare(participant: LocalParticipant, mode: ShareMode): Promise<void> {
  const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions(mode));
  const video = stream.getVideoTracks()[0];
  const audio = stream.getAudioTracks()[0];
  if (!video) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('Nenhuma trilha de vídeo capturada.');
  }
  video.contentHint = SHARE_PRESETS[mode].contentHint;

  try {
    await participant.publishTrack(video, { source: Track.Source.ScreenShare, ...screenPublishOptions(mode) });
    if (audio) {
      await participant.publishTrack(audio, {
        source: Track.Source.ScreenShareAudio,
        audioPreset: AudioPresets.musicHighQualityStereo,
        dtx: false,
        red: false,
      });
    }
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    await participant.setScreenShareEnabled(false).catch(() => undefined);
    throw err;
  }
}

export async function stopScreenShare(participant: LocalParticipant): Promise<void> {
  await participant.setScreenShareEnabled(false);
}

/**
 * Troca de modo durante a transmissão: reaproveita a mesma captura (sem abrir o seletor de novo),
 * aplica as novas restrições e republica o vídeo com os novos parâmetros de codificação.
 */
export async function switchScreenShareMode(participant: LocalParticipant, mode: ShareMode): Promise<void> {
  const publication = participant.getTrackPublication(Track.Source.ScreenShare);
  const mediaTrack = publication?.track?.mediaStreamTrack;
  if (!publication?.track || !mediaTrack || mediaTrack.readyState === 'ended') return;

  await participant.unpublishTrack(publication.track, false);
  try {
    await mediaTrack.applyConstraints(screenVideoConstraints(mode));
  } catch (err) {
    // Alguns navegadores recusam mudar a captura em andamento; segue com a atual e só troca a codificação.
    console.warn('[tela] applyConstraints falhou', err);
  }
  mediaTrack.contentHint = SHARE_PRESETS[mode].contentHint;
  try {
    await participant.publishTrack(mediaTrack, { source: Track.Source.ScreenShare, ...screenPublishOptions(mode) });
  } catch (err) {
    mediaTrack.stop();
    await participant.setScreenShareEnabled(false).catch(() => undefined);
    throw err;
  }
}
