/**
 * End-to-end: the fork presents itself as Directito everywhere an end user
 * can see, and emits NO outbound requests to Directus-controlled endpoints.
 *
 * Assumes the instance was booted with tests/e2e-rebrand/boot-directus.sh.
 * Setup is performed via API when still pending (403 tolerated), so this
 * spec passes whether or not setup-ui.spec.ts ran first — as long as the
 * admin credentials below match.
 */
import { type APIRequestContext, expect, type Page, test } from '@playwright/test';

const DIRECTUS_URL = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8057';
const APP_URL = `${DIRECTUS_URL}/admin`;

const ADMIN = {
	first_name: 'E2E',
	last_name: 'Admin',
	email: 'admin@example.com',
	password: 'Admin123!',
};

// Any request matching these means data or the user agent is reaching
// Directus-controlled infrastructure.
const BLOCKED_URL_PATTERNS = [/directus\.io/, /telemetry\.directus\.io/, /registry\.npmjs\.org\/directus/];

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
	expect(
		outboundRequests,
		`outbound requests to Directus endpoints must never happen: ${outboundRequests.join(', ')}`,
	).toEqual([]);
}

async function ensureSetup(request: APIRequestContext) {
	const res = await request.post(`${DIRECTUS_URL}/server/setup`, {
		data: {
			first_name: ADMIN.first_name,
			last_name: ADMIN.last_name,
			email: ADMIN.email,
			password: ADMIN.password,
			password_confirm: ADMIN.password,
		},
	});

	// 403 means setup-ui.spec.ts (or a previous run) already completed setup.
	expect([200, 403]).toContain(res.status());
}

async function apiToken(request: APIRequestContext): Promise<string> {
	const res = await request.post(`${DIRECTUS_URL}/auth/login`, {
		data: { email: ADMIN.email, password: ADMIN.password },
	});

	expect(res.ok()).toBeTruthy();
	return (await res.json()).data.access_token as string;
}

test.describe('Directito rebrand', () => {
	test('server info seeds the Directito project name', async ({ request }) => {
		await ensureSetup(request);

		const infoRes = await request.get(`${DIRECTUS_URL}/server/info`);
		expect(infoRes.ok()).toBeTruthy();

		const info = (await infoRes.json()).data;
		expect(info.setupCompleted).toBe(true);
		expect(info.project.project_name).toBe('Directito');
	});

	test('served admin HTML carries Directito branding and no Directus links', async ({ request }) => {
		const res = await request.get(`${APP_URL}/`);
		expect(res.ok()).toBeTruthy();

		const html = await res.text();
		expect(html).toContain("Directito doesn't work without JavaScript");
		expect(html).not.toContain('directus.io');
		expect(html).not.toContain('directus.chat');
	});

	test('OpenAPI spec carries Directito info and no Directus contact/docs', async ({ request }) => {
		const res = await request.get(`${DIRECTUS_URL}/server/specs/oas`);
		expect(res.ok()).toBeTruthy();

		const text = await res.text();
		expect(text).toContain('Directito');
		expect(text).not.toContain('directus.io');
		expect(text).not.toContain('contact@directus.io');
	});

	test('Studio login shows Directito logo with no external help links', async ({ page, request }) => {
		trackOutbound(page);
		await ensureSetup(request);

		await page.goto(`${APP_URL}/login`);

		// Default (no custom logo) brand mark carries the Directito alt text.
		await expect(page.locator('img[alt="Directito"]').first()).toBeVisible({ timeout: 30_000 });

		// Help entries were removed: no link may point at Directus sites.
		await expect(page.locator('a[href*="directus.io"]')).toHaveCount(0);

		await page.locator('input[type="email"]').fill(ADMIN.email);
		await page.locator('input[type="password"]').fill(ADMIN.password);
		await page.locator('.buttons button').first().click();
		await expect(page).not.toHaveURL(/login/, { timeout: 30_000 });
		await expect(page).toHaveTitle(/Directito/);

		expectNoLeaks();
	});

	test('settings shows the Directito version label and no Directus links', async ({ page, request }) => {
		trackOutbound(page);
		await ensureSetup(request);
		const token = await apiToken(request);
		expect(token).toBeTruthy();

		await page.goto(`${APP_URL}/login`);
		await page.locator('input[type="email"]').fill(ADMIN.email);
		await page.locator('input[type="password"]').fill(ADMIN.password);
		await page.locator('.buttons button').first().click();
		await expect(page).not.toHaveURL(/login/, { timeout: 30_000 });

		await page.goto(`${APP_URL}/settings`);
		await expect(page.getByText(/Directito \d+\.\d+/).first()).toBeVisible({ timeout: 30_000 });
		await expect(page.locator('a[href*="directus.io"]')).toHaveCount(0);

		expectNoLeaks();
	});
});
