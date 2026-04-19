import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.test', override: false })

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET ?? '',
      APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
      AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ?? '',
      AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET ?? '',
      AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ?? '',
      DATABASE_URL: process.env.DATABASE_URL ?? '',
    },
  },
})
