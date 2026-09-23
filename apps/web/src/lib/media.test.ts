import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  displayMediaOptions,
  isCaptureCancelled,
  preferredVideoCodec,
  screenPublishOptions,
  screenVideoConstraints,
} from './media';

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

describe('modos', () => {
  it('Nítido: 1080p30, 6 Mbps, detail, balanced, sem simulcast', () => {
    stubCodecs(['video/H264']);
    expect(screenVideoConstraints('sharp')).toEqual({
      width: { max: 1920 },
      height: { max: 1080 },
      frameRate: { ideal: 30, max: 30 },
    });
    expect(screenPublishOptions('sharp')).toMatchObject({
      videoCodec: 'h264',
      simulcast: false,
      screenShareEncoding: { maxBitrate: 6_000_000, maxFramerate: 30 },
      degradationPreference: 'balanced',
    });
  });

  it('Fluido: 1080p60, 10 Mbps, maintain-framerate', () => {
    expect(screenVideoConstraints('smooth')).toMatchObject({ width: { max: 1920 }, frameRate: { ideal: 60 } });
    expect(screenPublishOptions('smooth')).toMatchObject({
      simulcast: false,
      screenShareEncoding: { maxBitrate: 10_000_000, maxFramerate: 60 },
      degradationPreference: 'maintain-framerate',
    });
  });

  it('Ultra: resolução nativa (sem limite), 60 fps, 15 Mbps, balanced', () => {
    const c = screenVideoConstraints('ultra');
    expect(c).not.toHaveProperty('width');
    expect(c).not.toHaveProperty('height');
    expect(c.frameRate).toEqual({ ideal: 60, max: 60 });
    expect(screenPublishOptions('ultra')).toMatchObject({
      simulcast: false,
      screenShareEncoding: { maxBitrate: 15_000_000, maxFramerate: 60 },
      degradationPreference: 'balanced',
    });
  });

  it('pede áudio da tela opcional', () => {
    expect(displayMediaOptions('sharp')).toMatchObject({ audio: true, systemAudio: 'include' });
  });
});

describe('isCaptureCancelled', () => {
  it('reconhece cancelamento do seletor', () => {
    expect(isCaptureCancelled(new DOMException('x', 'NotAllowedError'))).toBe(true);
    expect(isCaptureCancelled(new Error('Permission denied by user'))).toBe(true);
    expect(isCaptureCancelled(new Error('outra coisa'))).toBe(false);
  });
});
