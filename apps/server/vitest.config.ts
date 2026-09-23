import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@telinha/source'] },
  ssr: { resolve: { conditions: ['@telinha/source'] } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
