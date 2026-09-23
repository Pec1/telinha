import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCaptureCancelled, preferredVideoCodec, screenCaptureOptions, screenPublishOptions } from './media';

afterEach(() => vi.unstubAllGlobals());

function stubCodecs(mimeTypes: string[]) {
  vi.stubGlobal('RTCRtpSender', {
    getCapabilities: () => ({ codecs: mimeTypes.map((mimeType) => ({ mimeType, clockRate: 90000 })) }),
  });
}

describe('codec', () => {
  it('prefere H.264 quando disponível', () => {
    stubCodecs(['video/VP8', 'video/H264']);
    expect(preferredVideoCodec()).toBe('h264');
  });
  it('cai para VP8 sem H.264', () => {
    stubCodecs(['video/VP8', 'video/VP9']);
    expect(preferredVideoCodec()).toBe('vp8');
  });
});

describe('presets', () => {
  it('Nítido: 1080p30, 4 Mbps, detail, maintain-resolution, sem simulcast', () => {
    stubCodecs(['video/H264']);
    expect(screenCaptureOptions('sharp')).toMatchObject({
      audio: true,
      resolution: { width: 1920, height: 1080, frameRate: 30 },
      contentHint: 'detail',
    });
    expect(screenPublishOptions('sharp')).toMatchObject({
      videoCodec: 'h264',
      simulcast: false,
      screenShareEncoding: { maxBitrate: 4_000_000, maxFramerate: 30 },
      degradationPreference: 'maintain-resolution',
    });
  });
  it('Fluido: 1080p60, 8 Mbps, motion, balanced', () => {
    stubCodecs(['video/H264']);
    expect(screenCaptureOptions('smooth')).toMatchObject({
      resolution: { width: 1920, height: 1080, frameRate: 60 },
      contentHint: 'motion',
    });
    expect(screenPublishOptions('smooth')).toMatchObject({
      screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
      degradationPreference: 'balanced',
    });
  });
});

describe('isCaptureCancelled', () => {
  it('reconhece cancelamento do seletor', () => {
    expect(isCaptureCancelled(new DOMException('x', 'NotAllowedError'))).toBe(true);
    expect(isCaptureCancelled(new Error('Permission denied by user'))).toBe(true);
    expect(isCaptureCancelled(new Error('outra coisa'))).toBe(false);
  });
});
