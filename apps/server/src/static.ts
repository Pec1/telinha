import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

/** apps/server/dist → apps/web/dist */
export const defaultWebDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

/**
 * Serve o build do frontend. Arquivos existentes são servidos direto; qualquer outra rota
 * GET fora de /api cai no index.html (SPA: /, /s/:code...).
 */
export function mountFrontend(app: Hono, webDist: string = defaultWebDist): boolean {
  const indexHtml = join(webDist, 'index.html');
  if (!existsSync(indexHtml)) {
    console.warn(`[static] ${indexHtml} não encontrado; frontend não será servido.`);
    return false;
  }

  const assets = serveStatic({ root: webDist });
  const spaFallback = serveStatic({ path: indexHtml });
  const isApi = (path: string) => path === '/api' || path.startsWith('/api/');

  // O header precisa ser definido antes do serveStatic montar a resposta.
  app.get('*', (c, next) => {
    if (isApi(c.req.path)) return next();
    // Arquivos em /assets têm hash no nome: podem ser cacheados para sempre.
    const immutable = c.req.path.startsWith('/assets/');
    c.header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    return assets(c, next);
  });
  app.get('*', (c, next) => {
    if (isApi(c.req.path)) return next();
    c.header('Cache-Control', 'no-cache');
    return spaFallback(c, next);
  });
  return true;
}
