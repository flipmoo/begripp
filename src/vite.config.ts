import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { API_PORT, FRONTEND_PORT } from './config/ports';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Use the configured frontend port
    port: FRONTEND_PORT,
    // Proxy API requests to the backend
    proxy: {
      '/api': {
        // API server runs on the configured API port
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './')
    }
  }
});