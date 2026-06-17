import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Inject Firebase env vars into the service worker public files at build time
const firebaseDefine = {
  '__FIREBASE_API_KEY__': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || ''),
  '__FIREBASE_AUTH_DOMAIN__': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
  '__FIREBASE_PROJECT_ID__': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || ''),
  '__FIREBASE_STORAGE_BUCKET__': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || ''),
  '__FIREBASE_MESSAGING_SENDER_ID__': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
  '__FIREBASE_APP_ID__': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || ''),
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: firebaseDefine,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
      'socket.io-client': path.resolve(__dirname, '../../node_modules/socket.io-client')
    }
  },
  server: {
    // Web app on 3000; API on 3001 (override with VITE_DEV_PORT / run backend with PORT).
    port: parseInt(process.env.VITE_DEV_PORT || '3000', 10),
    allowedHosts: ['smoky-majestic-pope.ngrok-free.dev', 'kivoviet.com'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        // NestJS uses setGlobalPrefix('api') — pass through as-is
      },
      '/uploads': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Ensure WebSocket upgrade headers are forwarded
            if (req.headers.upgrade) {
              proxyReq.setHeader('Upgrade', req.headers.upgrade);
            }
          });
        },
      },
    },
  },
})
