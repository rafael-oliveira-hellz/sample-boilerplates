import federation from '@originjs/vite-plugin-federation';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'json_mapper_remote',
      filename: 'remoteEntry.js',
      exposes: {
        './remote-entry': './src/bootstrap/remote-entry.tsx',
        './json-mapper-widget': './src/widgets/index.ts'
      },
      shared: ['react', 'react-dom']
    })
  ],
  server: {
    port: 4101
  },
  preview: {
    port: 4101
  },
  build: {
    target: 'esnext',
    minify: false
  }
});
