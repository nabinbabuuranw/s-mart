import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', timeout: 60000, workers: 1, retries: 0, reporter: [['list'],['json',{outputFile:'/tmp/admin-e2e.json'}]],
  use: { baseURL: 'http://localhost:3100', headless: true, trace: 'off' }, projects: [{ name: 'chromium', use: { browserName: 'chromium' } }] });
