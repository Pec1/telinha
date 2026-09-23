import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@telinha/source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['@telinha/source'] } },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'node' },
});
