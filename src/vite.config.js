import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Uncomment this when testing with ngrok on smartphone
  // Replace with your ngrok API URL
  // server: {
  //   proxy: {
  //     '/api': {
  //       target: 'https://your-ngrok-api-url.ngrok.io',
  //       changeOrigin: true,
  //     }
  //   }
  // },

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
