import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4100',
    headless: true
  },
  webServer: [
    {
      command: 'npm run build --workspace @porto/mfe-json-mapper-react && npm run preview --workspace @porto/mfe-json-mapper-react -- --host 127.0.0.1',
      url: 'http://127.0.0.1:4101',
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: 'npm run build --workspace @porto/host-shell-react && npm run preview --workspace @porto/host-shell-react -- --host 127.0.0.1',
      url: 'http://127.0.0.1:4100',
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
});
