import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEARTBEAT_INTERVAL_MS } from './useHeartbeat';

afterEach(() => vi.useRealTimers());

describe('heartbeat', () => {
  it('intervalo de 5 minutos (abaixo dos 15 min de hibernação do Render)', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(300_000);
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(15 * 60_000);
  });
});
