/**
 * End-to-end: OpenAI-Compatible Responses transport + Chat Completions regression
 * + AI Assistant icon visibility, through the real Directus UI.
 *
 * Requires:
 *   - Directus (this branch, SQLite) running at DIRECTUS_URL (default http://127.0.0.1:8055)
 *   - Mock AI server (mock-server/server.mjs) running at MOCK_URL (default http://127.0.0.1:18055)
 *   - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for an admin account
 *
 * The mock uses fake credentials only. The real OpenCode key is never used here.
 */
import { type APIRequestContext, expect, test } from '@playwright/test';

const DIRECTUS_URL = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8055';
const APP_URL = `${DIRECTUS_URL}/admin`;
const MOCK_URL = process.env['MOCK_URL'] ?? 'http://127.0.0.1:18055';
const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'Admin123!';

async function apiToken(request: APIRequestContext): Promise<string> {
	const res = await request.post(`${DIRECTUS_URL}/auth/login`, {
		data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
	});

	expect(res.ok()).toBeTruthy();
	const json = await res.json();
	return json.data.access_token as string;
}

async function patchSettings(request: APIRequestContext, token: string, patch: Record<string, unknown>) {
	const res = await request.patch(`${DIRECTUS_URL}/settings`, {
		headers: { Authorization: `Bearer ${token}` },
		data: patch,
	});

	expect(res.ok()).toBeTruthy();
}

async function getSettings(request: APIRequestContext, token: string) {
	const res = await request.get(`${DIRECTUS_URL}/settings`, {
		headers: { Authorization: `Bearer ${token}` },
	});

	expect(res.ok()).toBeTruthy();
	return (await res.json()).data;
}

async function mockLog(request: APIRequestContext) {
	const res = await request.get(`${MOCK_URL}/__log`);
	expect(res.ok()).toBeTruthy();
	return (await res.json()) as Array<{ method: string; url: string; headers: Record<string, string>; model: string }>;
}

async function mockReset(request: APIRequestContext) {
	await request.post(`${MOCK_URL}/__reset`);
}

async function loginUi(page: import('@playwright/test').Page) {
	await page.goto(`${APP_URL}/login`);
	await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
	await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
	await page.locator('.buttons button').first().click();
	await expect(page).not.toHaveURL(/login/, { timeout: 30_000 });

	// Dismiss the first-run owner dialog when present
	const remindLater = page.getByRole('button', { name: 'Remind Later' });

	if (await remindLater.isVisible({ timeout: 5_000 }).catch(() => false)) {
		await remindLater.click();
	}
}

function responsesPatch() {
	return {
		ai_openai_compatible_api_key: 'e2e-fake-key',
		ai_openai_compatible_base_url: `${MOCK_URL}/v1`,
		ai_openai_compatible_name: 'E2E Mock',
		ai_openai_compatible_protocol: 'responses',
		ai_openai_compatible_session_header: 'x-opencode-session',
		ai_openai_compatible_headers: [{ header: 'User-Agent', value: 'directito-classlog-ai/1.0' }],
		ai_openai_compatible_models: [{ id: 'e2e-model', name: 'E2E Model', context: 100000, output: 8000 }],
	};
}

test.describe('AI assistant over Responses transport', () => {
	test('configure responses, chat twice, clear, verify session rotation, icon visible', async ({ page, request }) => {
		const token = await apiToken(request);
		await mockReset(request);
		await patchSettings(request, token, responsesPatch());

		// Persistence: reopen settings and verify values round-trip
		const settings = await getSettings(request, token);
		expect(settings.ai_openai_compatible_protocol).toBe('responses');
		expect(settings.ai_openai_compatible_session_header).toBe('x-opencode-session');
		expect(settings.ai_openai_compatible_base_url).toBe(`${MOCK_URL}/v1`);

		// Log in through the real UI
		await loginUi(page);

		// AI Assistant trigger with the magic icon must be present and visible
		const trigger = page.locator('.collapsible-trigger').first();
		await expect(trigger).toBeVisible({ timeout: 30_000 });

		const iconPaths = page.locator('svg.ai-magic-button path');
		expect(await iconPaths.count()).toBe(2);

		for (let i = 0; i < 2; i++) {
			const d = await iconPaths.nth(i).getAttribute('d');
			expect(d, `icon path ${i} must carry a literal d attribute (Safari fix)`).toBeTruthy();
			const box = await iconPaths.nth(i).boundingBox();
			expect(box, `icon path ${i} must have a visible bounding box`).toBeTruthy();
			expect(box!.width + box!.height).toBeGreaterThan(0);
		}

		// Open the assistant and send the first message
		await trigger.click();
		const conversation = page.locator('.ai-conversation');
		await expect(conversation).toBeVisible();

		const input = page.locator('.ai-textarea');
		await expect(input).toBeVisible();
		await input.fill('first message');
		await page.locator('.submit-button').click();
		await expect(conversation).toContainText('E2E-OK turn-1', { timeout: 60_000 });

		// Second message in the same conversation
		await input.fill('second message');
		await page.locator('.submit-button').click();
		await expect(conversation).toContainText('E2E-OK turn-2', { timeout: 60_000 });

		let log = await mockLog(request);
		const responsesCalls = log.filter((r) => r.url === '/v1/responses');
		expect(responsesCalls.length).toBeGreaterThanOrEqual(2);
		expect(log.some((r) => r.url.includes('chat/completions'))).toBe(false);

		for (const call of responsesCalls) {
			expect(call.headers['user-agent']).toContain('directito-classlog-ai/1.0');
			expect(call.headers['x-opencode-session']).toBeTruthy();
		}

		const firstSession = responsesCalls[0]!.headers['x-opencode-session'];
		expect(responsesCalls[1]!.headers['x-opencode-session']).toBe(firstSession);

		// Clear the conversation, then chat again: session must rotate.
		// (The mock numbers responses by request count, so this is turn-3.)
		await page.locator('.ai-header .v-button').first().click();
		await input.fill('new conversation message');
		await page.locator('.submit-button').click();
		await expect(conversation).toContainText('E2E-OK turn-3', { timeout: 60_000 });

		log = await mockLog(request);
		const latest = log.filter((r) => r.url === '/v1/responses').at(-1)!;
		expect(latest.headers['x-opencode-session']).toBeTruthy();
		expect(latest.headers['x-opencode-session']).not.toBe(firstSession);
	});

	test('chat completions mode still works', async ({ page, request }) => {
		const token = await apiToken(request);
		await mockReset(request);
		await patchSettings(request, token, { ...responsesPatch(), ai_openai_compatible_protocol: 'chat-completions' });

		await loginUi(page);

		const trigger = page.locator('.collapsible-trigger').first();
		await expect(trigger).toBeVisible({ timeout: 30_000 });
		await trigger.click();

		const conversation = page.locator('.ai-conversation');
		await expect(conversation).toBeVisible();
		const input = page.locator('.ai-textarea');
		await expect(input).toBeVisible();
		await input.fill('hello chat completions');
		await page.locator('.submit-button').click();
		await expect(conversation).toContainText('E2E-CHAT-OK', { timeout: 60_000 });

		const log = await mockLog(request);
		expect(log.some((r) => r.url === '/v1/chat/completions')).toBe(true);
		expect(log.some((r) => r.url === '/v1/responses')).toBe(false);
	});
});
