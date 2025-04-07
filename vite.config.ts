import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { FRONTEND_PORT, API_PORT, killProcessOnPort } from './src/config/ports';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // Beschikbaar maken op alle netwerkinterfaces
    port: FRONTEND_PORT,
    strictPort: true, // Don't try alternative ports
    onServerStart: async (server) => {
      server.httpServer?.on('error', async (e) => {
        if (e.code === 'EADDRINUSE') {
          console.error(`Port ${FRONTEND_PORT} is in use. Attempting to kill the process...`);
          const killed = await killProcessOnPort(FRONTEND_PORT);
          if (killed) {
            console.log(`Successfully killed process on port ${FRONTEND_PORT}. Restarting server...`);
            // The server will restart automatically when strictPort is true
          } else {
            console.error(`Failed to kill process on port ${FRONTEND_PORT}. Please kill it manually.`);
          }
        }
      });
    },
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
    },
  },
}); 
