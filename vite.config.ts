import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { FRONTEND_PORT, API_PORT } from './src/config/ports';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Mock Node.js modules
      'sqlite3': path.resolve(__dirname, './src/mocks/sqlite3.ts'),
      'sqlite': path.resolve(__dirname, './src/mocks/sqlite.ts'),
      'better-sqlite3': path.resolve(__dirname, './src/mocks/better-sqlite3.ts'),
      // Mock Node.js core modules
      'fs': path.resolve(__dirname, './src/mocks/fs.ts'),
      'path': path.resolve(__dirname, './src/mocks/path.ts'),
      'url': path.resolve(__dirname, './src/mocks/url.ts'),
      // Mock specific sqlite modules
      '/node_modules/sqlite/build/Database.js': path.resolve(__dirname, './src/mocks/Database.js'),
      '/node_modules/sqlite/build/Statement.js': path.resolve(__dirname, './src/mocks/Statement.js'),
    },
  },
  optimizeDeps: {
    exclude: ['sqlite3', 'better-sqlite3', 'sqlite', 'fs', 'path', 'url'],
  },
  build: {
    commonjsOptions: {
      esmExternals: true,
    },
  },
  define: {
    // Polyfill for Node.js process
    'process.env': {},
  },
  server: {
    host: true, // Luister op alle beschikbare netwerkinterfaces
    port: FRONTEND_PORT, // Gebruik geconfigureerde poort voor de frontend
    strictPort: true, // Gebruik altijd de geconfigureerde poort
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('Sending Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response:', proxyRes.statusCode, req.url);
          });
        }
      },
    },
  },
});
