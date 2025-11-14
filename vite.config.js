// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';


export default defineConfig((mode) => {
  return {
    esbuild: {
      pure: mode === "production" ? ["console.log"] : [],
    },
    build: {
      outDir: "build/tender",
    },
    plugins: [react()],
    server: {
      port: 3001,
      strictPort: true,
      host: true,
      proxy: {
        '/api': {
          target: 'http://192.168.4.107:8008',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      }
    },
  };
});