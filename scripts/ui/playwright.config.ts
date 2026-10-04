import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  outputDir: '../../test-results',
  use: { browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    {
      command:
        'pnpm --filter @myims/command-center-web exec next start --hostname 127.0.0.1 --port 3200',
      url: 'http://localhost:3200',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        'pnpm --filter @myims/platform-console-web exec next start --hostname 127.0.0.1 --port 3201',
      url: 'http://localhost:3201',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
