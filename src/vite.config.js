import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },

  // When testing with ngrok on smartphone, replace target above with your ngrok API URL

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'; // Separa las dependencias en un archivo aparte
          }
        },
      },
    },
    chunkSizeWarningLimit: 700, // Ajusta este valor si es necesario
  },
});
