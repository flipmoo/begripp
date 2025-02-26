import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ClientRequest } from 'http';
import type { ProxyOptions } from 'vite';

interface ExtendedIncomingMessage extends IncomingMessage {
  body?: Record<string, unknown>;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // We keep this even if not used directly as it's needed for the environment setup
  loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 4001, // Use port 4001 since 4000 is in use
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error('Vite proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.method === 'POST' && req.body) {
                const bodyData = JSON.stringify(req.body);
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
              }
            });
          }
        }
      },
    },
  };
}); 
