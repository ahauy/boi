import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

const serveStaticAiAssets = () => ({
  name: 'serve-static-ai-assets',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const rawUrl = req.url || '';
      const cleanPath = rawUrl.split('?')[0];
      if (
        cleanPath.startsWith('/onnx/') ||
        cleanPath.startsWith('/mediapipe/') ||
        cleanPath.startsWith('/models/')
      ) {
        const filePath = resolve(
          import.meta.dirname,
          'public',
          cleanPath.replace(/^\/+/, '')
        );
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
          } else if (filePath.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          } else {
            res.setHeader('Content-Type', 'application/octet-stream');
          }
          res.setHeader('Cache-Control', 'public, max-age=3600');
          createReadStream(filePath).pipe(res);
          return;
        }
      }
      next();
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const proxyTarget = env.API_PROXY_TARGET || process.env.API_PROXY_TARGET || 'http://localhost:4000';
  const rawAllowedHosts = env.DEV_ALLOWED_HOSTS || process.env.DEV_ALLOWED_HOSTS || '';
  const allowedHosts = rawAllowedHosts
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  return {
    plugins: [serveStaticAiAssets(), react()],
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api/v1': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
      ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
    },
  };
});
