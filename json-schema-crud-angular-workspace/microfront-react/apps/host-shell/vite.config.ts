import federation from '@originjs/vite-plugin-federation';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'host_shell',
      remotes: {
        json_mapper_remote: 'http://localhost:4101/assets/remoteEntry.js'
      },
      shared: ['react', 'react-dom']
    })
  ],
  server: {
    port: 4100
  },
  preview: {
    port: 4100
  },
  build: {
    target: 'esnext',
    minify: false
  }
});
