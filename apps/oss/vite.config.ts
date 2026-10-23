import { defineConfig } from 'vite';
import type { IndexHtmlTransformContext } from 'vite';
import react from '@vitejs/plugin-react';
import { validatedCatalogPlugin } from './catalog-plugin.ts';

export default defineConfig(async ({ command }) => ({
  plugins: [
    await validatedCatalogPlugin(command),
    react(),
    {
      name: 'development-csp',
      transformIndexHtml(html: string, context: IndexHtmlTransformContext) {
        // React's development preamble and Vite HMR need inline scripts/websockets.
        // Production HTML keeps the strict policy, supplemented by server headers.
        return context.server
          ? html.replace(/\s*<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/, '')
          : html;
      },
    },
  ],
  build: { outDir: '../../dist', emptyOutDir: true, sourcemap: false },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
}));
