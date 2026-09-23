import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Em dev, @telinha/shared é resolvido direto do código-fonte TypeScript.
    conditions: ['@telinha/source', ...defaultClientConditions],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['.app.github.dev'],
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
