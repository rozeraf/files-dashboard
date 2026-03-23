import { defineConfig, devices } from '@playwright/test'

const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/usr/bin/chromium'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4541'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      executablePath: chromiumPath,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    },
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'node ./e2e/run-test-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
