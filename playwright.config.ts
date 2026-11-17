import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox-accessibility', testMatch: 'accessibility.spec.ts', use: devices['Desktop Firefox'] },
    { name: 'webkit-accessibility', testMatch: 'accessibility.spec.ts', use: devices['Desktop Safari'] },
  ],
  webServer: {
    command: `npm run dev -- --webpack --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AUTH_SECRET: 'local-e2e-secret-keep-out-of-production-123',
      DATABASE_URL: 'postgresql://kctf_test:kctf_test@127.0.0.1:5433/kctf_test',
    },
  },
});
