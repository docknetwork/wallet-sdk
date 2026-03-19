const {defineConfig, devices} = require('@playwright/test');

module.exports = defineConfig({
  testDir: './bundler/test',
  testMatch: '**/*.test.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', {outputFolder: 'playwright-report'}]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],

  webServer: {
    command: 'npx http-server . -p 8787 -c-1',
    port: 8787,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
