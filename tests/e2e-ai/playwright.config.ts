import { defineConfig, devices } from '@playwright/test';

const DIRECTUS_URL = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8055';
const MOCK_URL = process.env['MOCK_URL'] ?? 'http://127.0.0.1:18055';

export default defineConfig({
	testDir: './tests',
	timeout: 120_000,
	expect: { timeout: 30_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	screenshot: 'only-on-failure',
	video: 'off',
	trace: 'off',
	use: {
		baseURL: DIRECTUS_URL,
		extraHTTPHeaders: {},
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
	],
	metadata: { DIRECTUS_URL, MOCK_URL },
});
