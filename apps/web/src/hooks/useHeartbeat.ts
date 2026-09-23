import { useEffect } from 'react';

export const HEARTBEAT_INTERVAL_MS = 5 * 60_000;

/**
 * Enquanto conectado numa sala, chama GET /health a cada 5 minutos: o plano free do Render
 * hiberna após 15 minutos sem requisições (e a mídia não passa pelo server).
 */
export function useHeartbeat(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      fetch('/health', { cache: 'no-store' }).catch(() => undefined);
    }, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active]);
}
