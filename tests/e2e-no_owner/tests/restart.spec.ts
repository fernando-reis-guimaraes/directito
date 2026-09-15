/**
 * Restart check: boot the same database again (owner never provided) and prove
 * login + Studio + API work with no owner popup and no pending state.
 */
import { type APIRequestContext, expect, test } from '@playwright/test';

const DIRECTUS_URL = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8056';
const APP_URL = `${DIRECTUS_URL}/admin`;
const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'Admin123!';

async function apiToken(request: APIRequestContext): Promise<string> {
	const res = await request.post(`${DIRECTUS_URL}/auth/login`, {
		data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
	});

	expect(res.ok()).toBeTruthy();
	return (await res.json()).data.access_token as string;
}

test.describe('restart without owner information', () => {
	test('setup stays complete, owner stays null, login works, no popup', async ({ page, request }) => {
		const infoRes = await request.get(`${DIRECTUS_URL}/server/info`);
		expect(infoRes.ok()).toBeTruthy();
		expect((await infoRes.json()).data.setupCompleted).toBe(true);

		const token = await apiToken(request);

		const settingsRes = await request.get(`${DIRECTUS_URL}/settings`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(settingsRes.ok()).toBeTruthy();
		const settings = (await settingsRes.json()).data;
		expect(settings.project_owner).toBeNull();
		expect(settings.project_status ?? null).not.toBe('pending');

		const meRes = await request.get(`${DIRECTUS_URL}/users/me`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(meRes.ok()).toBeTruthy();

		await page.goto(`${APP_URL}/login`);
		await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
		await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
		await page.locator('.buttons button').first().click();
		await expect(page).not.toHaveURL(/login/, { timeout: 30_000 });

		await expect(page.getByRole('button', { name: 'Set Owner' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Remind Later' })).toHaveCount(0);

		await page.goto(`${APP_URL}/content`);
		await expect(page.locator('#app, .private-view, main').first()).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole('button', { name: 'Set Owner' })).toHaveCount(0);
	});
});
