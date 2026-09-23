import type { ScreenShareCaptureOptions, TrackPublishOptions, VideoCodec } from 'livekit-client';

export type ShareMode = 'sharp' | 'smooth';

interface SharePreset {
  label: string;
  description: string;
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
  contentHint: 'detail' | 'motion';
  degradationPreference: RTCDegradationPreference;
}

export const SHARE_PRESETS: Record<ShareMode, SharePreset> = {
  sharp: {
    label: 'Nítido',
    description: '1080p · 30 fps — ideal para texto, código e slides',
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 4_000_000,
    contentHint: 'detail',
    degradationPreference: 'maintain-resolution',
  },
  smooth: {
    label: 'Fluido',
    description: '1080p · 60 fps — ideal para vídeos e jogos',
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 8_000_000,
    contentHint: 'motion',
    degradationPreference: 'balanced',
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

export function screenCaptureOptions(mode: ShareMode): ScreenShareCaptureOptions {
  const p = SHARE_PRESETS[mode];
  return {
    // Oferece a opção de áudio no seletor; se a pessoa não marcar, segue só com vídeo.
    audio: true,
    systemAudio: 'include',
    resolution: { width: p.width, height: p.height, frameRate: p.frameRate },
    contentHint: p.contentHint,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
  };
}

export function screenPublishOptions(mode: ShareMode): TrackPublishOptions {
  const p = SHARE_PRESETS[mode];
  return {
    videoCodec: preferredVideoCodec(),
    backupCodec: false,
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
