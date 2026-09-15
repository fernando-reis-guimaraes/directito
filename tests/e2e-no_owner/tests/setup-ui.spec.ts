/**
 * Setup-through-Studio check on a FRESH database: the setup form completes with
 * only the admin account fields. Owner metadata and license acceptance are not
 * required, then login lands in Studio with no owner popup.
 */
import { expect, test } from '@playwright/test';

const DIRECTUS_URL = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8056';
const APP_URL = `${DIRECTUS_URL}/admin`;

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('studio setup without owner information', () => {
	test('setup form completes with admin account only', async ({ page, request }) => {
		const infoRes = await request.get(`${DIRECTUS_URL}/server/info`);
		expect(infoRes.ok()).toBeTruthy();
		expect((await infoRes.json()).data.setupCompleted).toBe(false);

		await page.goto(`${APP_URL}/setup`);
		await expect(page.getByText('Welcome to Directito')).toBeVisible({ timeout: 30_000 });

		// Admin account fields only: first name, last name, admin email, passwords.
		const textInputs = page.locator('.v-form input:not([type="password"])');
		await textInputs.nth(0).fill('E2E');
		await textInputs.nth(1).fill('Admin');
		await textInputs.nth(2).fill(ADMIN_EMAIL);

		const passwordInputs = page.locator('.v-form input[type="password"]');
		await passwordInputs.nth(0).fill(ADMIN_PASSWORD);
		await passwordInputs.nth(1).fill(ADMIN_PASSWORD);

		// Launch must be enabled WITHOUT owner metadata or license acceptance.
		const launch = page.getByRole('button', { name: 'Launch Directito' });
		await expect(launch).toBeEnabled({ timeout: 10_000 });
		await launch.click();

		// Auto-login lands in Studio.
		await expect(page).not.toHaveURL(/setup|login/, { timeout: 60_000 });

		// Owner was never provided, yet no owner popup appears.
		await expect(page.getByRole('button', { name: 'Set Owner' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Remind Later' })).toHaveCount(0);

		const login = await request.post(`${DIRECTUS_URL}/auth/login`, {
			data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
		});

		expect(login.ok()).toBeTruthy();
		const token = (await login.json()).data.access_token as string;
		const settingsRes = await request.get(`${DIRECTUS_URL}/settings`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(settingsRes.ok()).toBeTruthy();
		expect((await settingsRes.json()).data.project_owner).toBeNull();
	});
});
