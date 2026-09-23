import type { TrackPublishOptions, VideoCodec } from 'livekit-client';

export type ShareMode = 'sharp' | 'smooth' | 'ultra';

export const SHARE_MODES: ShareMode[] = ['sharp', 'smooth', 'ultra'];

interface SharePreset {
  label: string;
  /** Resumo curto para o seletor. */
  short: string;
  description: string;
  /** Limite de resolução; null = resolução nativa da tela. */
  maxResolution: { width: number; height: number } | null;
  frameRate: number;
  maxBitrate: number;
  contentHint: 'detail' | 'motion';
  degradationPreference: RTCDegradationPreference;
  /** Aviso exibido na UI ao escolher o modo. */
  warning?: string;
}

export const SHARE_PRESETS: Record<ShareMode, SharePreset> = {
  sharp: {
    label: 'Nítido',
    short: '1080p · 30 fps',
    description: '1080p · 30 fps · até 6 Mbps. Ideal para texto, código e slides.',
    maxResolution: { width: 1920, height: 1080 },
    frameRate: 30,
    maxBitrate: 6_000_000,
    contentHint: 'detail',
    degradationPreference: 'balanced',
  },
  smooth: {
    label: 'Fluido',
    short: '1080p · 60 fps',
    description: '1080p · 60 fps · até 10 Mbps. Ideal para vídeos e jogos.',
    maxResolution: { width: 1920, height: 1080 },
    frameRate: 60,
    maxBitrate: 10_000_000,
    contentHint: 'motion',
    degradationPreference: 'maintain-framerate',
  },
  ultra: {
    label: 'Ultra',
    short: 'nativa · 60 fps',
    description: 'Resolução nativa da tela · 60 fps · até 15 Mbps.',
    maxResolution: null,
    frameRate: 60,
    maxBitrate: 15_000_000,
    contentHint: 'motion',
    degradationPreference: 'balanced',
    warning: 'Exige upload alto (cerca de 15 Mbps). Se a imagem travar, use Fluido ou Nítido.',
  },
};

/** H.264 tem mais chance de encoder por hardware (menos CPU); VP8 é o fallback universal. */
export function preferredVideoCodec(): VideoCodec {
  try {
    const codecs = RTCRtpSender.getCapabilities?.('video')?.codecs ?? [];
    return codecs.some((c) => c.mimeType.toLowerCase() === 'video/h264') ? 'h264' : 'vp8';
  } catch {
    return 'vp8';
  }
}

/** Restrições de vídeo da captura. Sem width/height no Ultra: o navegador entrega a resolução nativa. */
export function screenVideoConstraints(mode: ShareMode): MediaTrackConstraints {
  const p = SHARE_PRESETS[mode];
  return {
    frameRate: { ideal: p.frameRate, max: p.frameRate },
    ...(p.maxResolution && {
      width: { max: p.maxResolution.width },
      height: { max: p.maxResolution.height },
    }),
  };
}

/** Opções do getDisplayMedia (inclui campos ainda não tipados no lib.dom). */
export function displayMediaOptions(mode: ShareMode): DisplayMediaStreamOptions {
  return {
    video: screenVideoConstraints(mode),
    // Oferece a opção de áudio no seletor; se a pessoa não marcar, segue só com vídeo.
    audio: true,
    systemAudio: 'include',
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
  } as DisplayMediaStreamOptions;
}

export function screenPublishOptions(mode: ShareMode): TrackPublishOptions {
  const p = SHARE_PRESETS[mode];
  return {
    videoCodec: preferredVideoCodec(),
    backupCodec: false,
    // Uma única camada: o SFU não tem versão reduzida para enviar a ninguém.
    simulcast: false,
    screenShareEncoding: { maxBitrate: p.maxBitrate, maxFramerate: p.frameRate },
    degradationPreference: p.degradationPreference,
  };
}

export function canCaptureScreen(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

/** Usuário fechou/cancelou o seletor de tela do navegador: não é erro. */
export function isCaptureCancelled(err: unknown): boolean {
  const name = err instanceof Error || err instanceof DOMException ? err.name : '';
  const message = err instanceof Error ? err.message : '';
  return name === 'NotAllowedError' || name === 'AbortError' || /permission denied|cancel/i.test(message);
}
