import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);

/**
 * E2E contra o build de produção (server Hono servindo o web) e o LiveKit Cloud real.
 * Precisa de LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET e SESSION_SECRET no ambiente.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            // Aceita getDisplayMedia sem o seletor do navegador...
            '--use-fake-ui-for-media-stream',
            // ...escolhendo a tela inteira automaticamente...
            '--auto-select-desktop-capture-source=Entire screen',
            // ...e usando uma fonte de vídeo sintética (não há tela real no headless).
            '--use-fake-device-for-media-stream',
          ],
        },
      },
    },
  ],
  webServer: {
    // `exec` faz o node substituir o shell: ao terminar, o Playwright encerra o server de fato.
    command: 'pnpm build && exec node apps/server/dist/index.js',
    url: `http://127.0.0.1:${PORT}/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { NODE_ENV: 'production', PORT: String(PORT), RATE_LIMIT: 'off' },
    stdout: 'pipe',
  },
});
