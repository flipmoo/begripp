import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Use port 3000 by default for the frontend
    port: 3000,
    // Proxy API requests to the backend
    proxy: {
      '/api': {
        // API server runs on port 3002
        target: 'http://localhost:3002',
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