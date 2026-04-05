import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/__tests__/playwright',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
  },
  webServer: {
    command: 'npx vite --config vite.config.browser.ts --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
