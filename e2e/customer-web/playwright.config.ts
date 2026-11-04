import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', timeout: 90000, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: '/tmp/customer-e2e.json' }]],
  use: { baseURL: 'http://localhost:3101', headless: true, trace: 'off', viewport: { width: 1440, height: 900 } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
