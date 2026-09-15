/**
 * End-to-end: absent owner information is a valid normal state.
 *
 * Fresh instance (schema bootstrapped with --skipAdminInit, no admin user):
 *   1. completes initial setup WITHOUT any owner fields or license acceptance
 *   2. stores NULL owner metadata with no `pending` project_status
 *   3. logs in and uses Studio with NO owner popup/dialog
 *   4. uses the API normally with NO owner popup gating anything
 *   5. emits NO outbound request to Directus-controlled telemetry/owner endpoints
 */
import { type APIRequestContext, expect, test, type Page } from '@playwright/test';

const DIRECTUS_URL = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8056';
const APP_URL = `${DIRECTUS_URL}/admin`;

const ADMIN = {
	first_name: 'E2E',
	last_name: 'Admin',
	email: 'admin@example.com',
	password: 'Admin123!',
};

// Any request matching these means owner/telemetry data is leaving the box.
const BLOCKED_URL_PATTERNS = [/telemetry\.directus\.io/, /\/v1\/owner/, /directus\.io\/license-request/];

const outboundRequests: string[] = [];

function trackOutbound(page: Page) {
	page.on('request', (req) => {
		const url = req.url();

		if (BLOCKED_URL_PATTERNS.some((re) => re.test(url))) {
			outboundRequests.push(url);
		}
	});
}

function expectNoLeaks() {
	expect(outboundRequests, `outbound owner/telemetry requests must never happen: ${outboundRequests.join(', ')}`).toEqual(
		[],
	);
}

async function serverInfo(request: APIRequestContext) {
	const res = await request.get(`${DIRECTUS_URL}/server/info`);
	expect(res.ok()).toBeTruthy();
	return (await res.json()).data;
}

async function apiToken(request: APIRequestContext): Promise<string> {
	const res = await request.post(`${DIRECTUS_URL}/auth/login`, {
		data: { email: ADMIN.email, password: ADMIN.password },
	});

	expect(res.ok()).toBeTruthy();
	return (await res.json()).data.access_token as string;
}

async function getSettings(request: APIRequestContext, token: string) {
	const res = await request.get(`${DIRECTUS_URL}/settings`, {
		headers: { Authorization: `Bearer ${token}` },
	});

	expect(res.ok()).toBeTruthy();
	return (await res.json()).data;
}

async function expectNoOwnerDialog(page: Page) {
	// The removed popup's copy must never render, immediately or after a delay.
	await expect(page.getByRole('button', { name: 'Set Owner' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Remind Later' })).toHaveCount(0);
	await page.waitForTimeout(2_000);
	await expect(page.getByRole('button', { name: 'Set Owner' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Remind Later' })).toHaveCount(0);
}

test.describe('fresh install without owner information', () => {
	test('setup is incomplete on a fresh database', async ({ request }) => {
		const info = await serverInfo(request);
		expect(info.setupCompleted).toBe(false);
	});

	test('completes setup with admin account only (no owner fields, no license)', async ({ request }) => {
		const res = await request.post(`${DIRECTUS_URL}/server/setup`, {
			data: {
				first_name: ADMIN.first_name,
				last_name: ADMIN.last_name,
				email: ADMIN.email,
				password: ADMIN.password,
				password_confirm: ADMIN.password,
			},
		});

		expect(res.ok()).toBeTruthy();

		const info = await serverInfo(request);
		expect(info.setupCompleted).toBe(true);

		// Re-running setup must be rejected because setup is done — not because of owner state.
		const retry = await request.post(`${DIRECTUS_URL}/server/setup`, {
			data: {
				first_name: ADMIN.first_name,
				last_name: ADMIN.last_name,
				email: ADMIN.email,
				password: ADMIN.password,
				password_confirm: ADMIN.password,
			},
		});

		expect(retry.status()).toBe(403);
	});

	test('owner metadata stays null with no pending registration state', async ({ request }) => {
		const token = await apiToken(request);
		const settings = await getSettings(request, token);

		expect(settings.project_owner).toBeNull();
		expect(settings.project_usage).toBeNull();
		expect(settings.org_name).toBeNull();
		expect(settings.project_status ?? null, 'project_status must never be pending').not.toBe('pending');
	});

	test('API is usable without owner information', async ({ request }) => {
		const token = await apiToken(request);

		const me = await request.get(`${DIRECTUS_URL}/users/me`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(me.ok()).toBeTruthy();
		expect((await me.json()).data.email).toBe(ADMIN.email);

		const health = await request.get(`${DIRECTUS_URL}/server/health`);
		expect(health.ok()).toBeTruthy();
		expect((await health.json()).status).toBe('ok');
	});

	test('Studio login shows no owner popup and Studio stays usable', async ({ page, request }) => {
		trackOutbound(page);
		const token = await apiToken(request);
		const settings = await getSettings(request, token);
		expect(settings.project_owner).toBeNull();

		await page.goto(`${APP_URL}/login`);
		await page.locator('input[type="email"]').fill(ADMIN.email);
		await page.locator('input[type="password"]').fill(ADMIN.password);
		await page.locator('.buttons button').first().click();
		await expect(page).not.toHaveURL(/login/, { timeout: 30_000 });

		await expectNoOwnerDialog(page);

		// Studio navigation works: content module renders.
		await page.goto(`${APP_URL}/content`);
		await expect(page.locator('#app, .private-view, main').first()).toBeVisible({ timeout: 30_000 });
		await expectNoOwnerDialog(page);

		// No owner dismissal cookie may exist at all.
		const cookies = await page.context().cookies();
		expect(cookies.some((c) => c.name === 'license-banner-dismissed')).toBe(false);

		expectNoLeaks();
	});
});
