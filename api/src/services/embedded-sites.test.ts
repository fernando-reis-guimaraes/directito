import { ForbiddenError, InvalidCredentialsError, InvalidPayloadError } from '@directus/errors';
import { SchemaBuilder } from '@directus/schema-builder';
import type { SettingsModuleBarLink } from '@directus/types';
import knex, { type Knex } from 'knex';
import { createTracker, MockClient, type Tracker } from 'knex-mock-client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';
import { fetchGlobalAccess } from '../permissions/modules/fetch-global-access/fetch-global-access.js';
import { getAccountabilityForToken } from '../utils/get-accountability-for-token.js';
import { verifyAccessJWT } from '../utils/jwt.js';
import {
	EMBEDDED_SITE_CODE_TTL_MS,
	EmbeddedSitesService,
	isEmbeddedLink,
	normalizeEmbeddedLink,
	validateEmbeddedUrl,
} from './embedded-sites.js';

const codeStore = new Map<string, any>();

vi.mock('../../src/database/index', () => ({
	default: vi.fn(),
	getDatabaseClient: vi.fn().mockReturnValue('postgres'),
}));

vi.mock('../auth.js', () => ({
	getAuthProvider: vi.fn(),
}));

vi.mock('../cache.js', () => ({
	getCache: vi.fn(() => ({
		systemCache: {
			get: vi.fn((key: string) => Promise.resolve(codeStore.get(key))),
			set: vi.fn((key: string, value: any) => {
				codeStore.set(key, value);
				return Promise.resolve();
			}),
			delete: vi.fn((key: string) => Promise.resolve(codeStore.delete(key))),
		},
	})),
	getCacheValue: vi.fn(async (_cache: unknown, key: string) => codeStore.get(key)),
	setCacheValue: vi.fn(async (_cache: unknown, key: string, value: any) => {
		codeStore.set(key, value);
	}),
}));

vi.mock('../emitter.js', () => ({
	default: {
		emitFilter: vi.fn().mockImplementation((_event, payload) => Promise.resolve(payload)),
		emitAction: vi.fn(),
	},
}));

vi.mock('../permissions/lib/fetch-roles-tree.js', () => ({
	fetchRolesTree: vi.fn().mockResolvedValue([]),
}));

vi.mock('../permissions/modules/fetch-global-access/fetch-global-access.js', () => ({
	fetchGlobalAccess: vi.fn().mockResolvedValue({ app: true, admin: false }),
}));

vi.mock('../utils/get-secret.js', () => ({
	getSecret: vi.fn().mockReturnValue('test-secret'),
}));

const mockEnv = vi.hoisted(() => ({
	EMAIL_TEMPLATES_PATH: './templates',
	ACCESS_TOKEN_TTL: '15m',
	PUBLIC_URL: 'https://directito.example.com',
}));

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue(mockEnv),
}));

const schema = new SchemaBuilder()
	.collection('directus_users', (c) => {
		c.field('id').uuid().primary();
	})
	.build();

const mockUser = {
	id: 'user-id-1',
	role: 'role-id-1',
	email: 'user@example.com',
	first_name: 'Ada',
	last_name: 'Lovelace',
	language: 'en-US',
	status: 'active',
	tfa_secret: null,
	provider: 'default',
};

const identitySite: SettingsModuleBarLink = {
	type: 'link',
	id: 'site-grafana',
	name: 'Grafana',
	icon: 'monitoring',
	url: 'https://grafana.example.com',
	enabled: true,
	display: 'embedded',
	authentication: 'identity',
};

const apiSite: SettingsModuleBarLink = {
	type: 'link',
	id: 'site-chat',
	name: 'Chat',
	icon: 'chat',
	url: 'https://chat.example.com',
	enabled: true,
	display: 'embedded',
	authentication: 'directus-api',
};

const legacySite: SettingsModuleBarLink = {
	type: 'link',
	id: 'site-docs',
	name: 'Documentation',
	icon: 'menu_book',
	url: 'https://example.com/docs',
	enabled: true,
};

describe('Services / EmbeddedSites', () => {
	let db: MockedFunction<Knex>;
	let tracker: Tracker;

	beforeAll(() => {
		db = vi.mocked(knex.default({ client: MockClient }));
		tracker = createTracker(db);
	});

	beforeEach(() => {
		codeStore.clear();
		vi.mocked(fetchGlobalAccess).mockResolvedValue({ app: true, admin: false });
	});

	afterEach(() => {
		tracker.reset();
		vi.clearAllMocks();
	});

	const queueSettings = (moduleBar: SettingsModuleBarLink[] | string) => {
		tracker.on.select('directus_settings').responseOnce([{ module_bar: moduleBar }]);
	};

	const queueUsers = (...rows: any[]) => {
		for (const row of rows) {
			tracker.on.select('directus_users').responseOnce(Array.isArray(row) ? row : [row]);
		}
	};

	const createService = (userId: string | null = mockUser.id) =>
		new EmbeddedSitesService({
			knex: db,
			schema,
			accountability: userId ? ({ user: userId } as any) : null,
		});

	describe('normalizeEmbeddedLink', () => {
		it('treats legacy entries without new properties as external links with no authentication', () => {
			expect(normalizeEmbeddedLink(legacySite)).toEqual({ display: 'external', authentication: 'none' });
			expect(isEmbeddedLink(legacySite)).toBe(false);
		});

		it('preserves explicitly configured display and authentication modes', () => {
			expect(normalizeEmbeddedLink(identitySite)).toEqual({ display: 'embedded', authentication: 'identity' });
			expect(normalizeEmbeddedLink(apiSite)).toEqual({ display: 'embedded', authentication: 'directus-api' });
			expect(isEmbeddedLink(identitySite)).toBe(true);
		});
	});

	describe('validateEmbeddedUrl', () => {
		it('accepts http and https URLs and returns the origin', () => {
			expect(validateEmbeddedUrl('https://grafana.example.com/d/abc')).toEqual({
				origin: 'https://grafana.example.com',
			});

			expect(validateEmbeddedUrl('http://internal.local:3000/app')).toEqual({
				origin: 'http://internal.local:3000',
			});
		});

		it('rejects javascript:, data:, and other dangerous schemes', () => {
			for (const url of [
				'javascript:alert(1)',
				'JaVaScRiPt:alert(1)',
				'data:text/html,<h1>hi</h1>',
				'file:///etc/passwd',
				'ftp://files.example.com/x',
			]) {
				expect(() => validateEmbeddedUrl(url)).toThrow(InvalidPayloadError);
			}
		});

		it('rejects malformed and relative URLs', () => {
			expect(() => validateEmbeddedUrl('not a url')).toThrow(InvalidPayloadError);
			expect(() => validateEmbeddedUrl('/relative/path')).toThrow(InvalidPayloadError);
			expect(() => validateEmbeddedUrl('')).toThrow(InvalidPayloadError);
		});
	});

	describe('resolveEmbeddedSite', () => {
		it('parses stringified module_bar payloads as returned by raw database reads', async () => {
			queueSettings(JSON.stringify([identitySite]));

			const resolved = await createService().resolveEmbeddedSite('site-grafana');

			expect(resolved.authentication).toBe('identity');
			expect(resolved.origin).toBe('https://grafana.example.com');
		});

		it('rejects unparseable module_bar payloads', async () => {
			queueSettings('{not-json');

			await expect(createService().resolveEmbeddedSite('site-grafana')).rejects.toThrow(InvalidPayloadError);
		});

		it('resolves each configured site independently', async () => {
			queueSettings([identitySite]);
			const first = await createService().resolveEmbeddedSite('site-grafana');
			expect(first.authentication).toBe('identity');
			expect(first.origin).toBe('https://grafana.example.com');

			queueSettings([apiSite]);
			const second = await createService().resolveEmbeddedSite('site-chat');
			expect(second.authentication).toBe('directus-api');
			expect(second.origin).toBe('https://chat.example.com');
		});

		it('rejects unknown site ids', async () => {
			queueSettings([identitySite]);
			await expect(createService().resolveEmbeddedSite('site-missing')).rejects.toThrow(InvalidPayloadError);
		});

		it('rejects disabled entries', async () => {
			queueSettings([{ ...identitySite, enabled: false }]);
			await expect(createService().resolveEmbeddedSite('site-grafana')).rejects.toThrow(InvalidPayloadError);
		});

		it('rejects legacy external entries', async () => {
			queueSettings([legacySite]);
			await expect(createService().resolveEmbeddedSite('site-docs')).rejects.toThrow(InvalidPayloadError);
		});

		it('rejects entries with dangerous URL schemes', async () => {
			queueSettings([{ ...identitySite, url: 'javascript:alert(1)' }]);
			await expect(createService().resolveEmbeddedSite('site-grafana')).rejects.toThrow(InvalidPayloadError);
		});
	});

	describe('createSessionCode', () => {
		it('requires an authenticated session', async () => {
			await expect(createService(null).createSessionCode('site-grafana')).rejects.toThrow(ForbiddenError);
		});

		it('returns an opaque code without any token material', async () => {
			queueSettings([identitySite]);
			const result = await createService().createSessionCode('site-grafana');

			expect(result.code).toEqual(expect.any(String));
			expect(result.code.length).toBeGreaterThanOrEqual(21);
			expect(result.expires_in).toBe(EMBEDDED_SITE_CODE_TTL_MS);
			expect(result).not.toHaveProperty('access_token');
			expect(result).not.toHaveProperty('refresh_token');
		});

		it('refuses sites with authentication none', async () => {
			queueSettings([{ ...identitySite, authentication: 'none' }]);
			await expect(createService().createSessionCode('site-grafana')).rejects.toThrow(InvalidPayloadError);
		});
	});

	describe('redeemSessionCode', () => {
		const issueCode = async (site: SettingsModuleBarLink, userId: string = mockUser.id) => {
			queueSettings([site]);
			return createService(userId).createSessionCode(site.id);
		};

		it('returns identity but no API token in identity mode', async () => {
			const { code } = await issueCode(identitySite);

			queueSettings([identitySite]);
			queueUsers(mockUser);

			const result = await createService().redeemSessionCode('site-grafana', code);

			expect(result).toEqual({
				authentication: 'identity',
				user: {
					id: mockUser.id,
					role: mockUser.role,
					email: mockUser.email,
					first_name: mockUser.first_name,
					last_name: mockUser.last_name,
					language: mockUser.language,
				},
			});

			expect(result).not.toHaveProperty('access_token');
		});

		it('returns identity plus a verifiable API token in directus-api mode', async () => {
			const { code } = await issueCode(apiSite);

			queueSettings([apiSite]);
			queueUsers(mockUser, mockUser, []);

			const result = await createService().redeemSessionCode('site-chat', code);

			expect(result.authentication).toBe('directus-api');

			if (result.authentication !== 'directus-api') throw new Error('unreachable');

			expect(result.api_url).toBe('https://directito.example.com');
			expect(result.access_token).toEqual(expect.any(String));
			expect(result.expires).toBe(15 * 60 * 1000);
			expect(result).not.toHaveProperty('refresh_token');

			// The delegated token is accepted by the normal JWT verification path
			// with the same claims a login token carries for this user.
			const payload = verifyAccessJWT(result.access_token, 'test-secret');
			expect(payload.id).toBe(mockUser.id);
			expect(payload.role).toBe(mockUser.role);
			expect(payload.app_access).toBe(true);
			expect(payload.admin_access).toBe(false);
		});

		it('produces accountability equivalent to the user’s normal privileges', async () => {
			const { code } = await issueCode(apiSite);

			queueSettings([apiSite]);
			queueUsers(mockUser, mockUser, []);

			const result = await createService().redeemSessionCode('site-chat', code);
			if (result.authentication !== 'directus-api') throw new Error('unreachable');

			const accountability = await getAccountabilityForToken(result.access_token, undefined as any);

			expect(accountability.user).toBe(mockUser.id);
			expect(accountability.role).toBe(mockUser.role);
			expect(accountability.admin).toBe(false);
			expect(accountability.app).toBe(true);
		});

		it('preserves admin privileges for admin users', async () => {
			vi.mocked(fetchGlobalAccess).mockResolvedValue({ app: true, admin: true });

			const { code } = await issueCode(apiSite);

			queueSettings([apiSite]);
			queueUsers(mockUser, mockUser, []);

			const result = await createService().redeemSessionCode('site-chat', code);
			if (result.authentication !== 'directus-api') throw new Error('unreachable');

			const payload = verifyAccessJWT(result.access_token, 'test-secret');
			expect(payload.admin_access).toBe(true);

			const accountability = await getAccountabilityForToken(result.access_token, undefined as any);
			expect(accountability.admin).toBe(true);
		});

		it('reflects the role at redeem time and cannot exceed it', async () => {
			const { code } = await issueCode(apiSite);

			const changedUser = { ...mockUser, role: 'role-restricted' };

			queueSettings([apiSite]);
			queueUsers(changedUser, changedUser, []);

			const result = await createService().redeemSessionCode('site-chat', code);
			if (result.authentication !== 'directus-api') throw new Error('unreachable');

			const payload = verifyAccessJWT(result.access_token, 'test-secret');
			expect(payload.role).toBe('role-restricted');
			expect(result.user.role).toBe('role-restricted');
		});

		it('rejects a code redeemed twice', async () => {
			const { code } = await issueCode(identitySite);

			queueSettings([identitySite]);
			queueUsers(mockUser);

			await createService().redeemSessionCode('site-grafana', code);

			await expect(createService().redeemSessionCode('site-grafana', code)).rejects.toThrow(InvalidCredentialsError);
		});

		it('rejects expired codes', async () => {
			const { code } = await issueCode(identitySite);

			const stored = codeStore.get(`embedded-site-code:${code}`);
			codeStore.set(`embedded-site-code:${code}`, { ...stored, expiresAt: Date.now() - 1 });

			await expect(createService().redeemSessionCode('site-grafana', code)).rejects.toThrow(InvalidCredentialsError);
		});

		it('rejects unknown codes', async () => {
			await expect(createService().redeemSessionCode('site-grafana', 'no-such-code')).rejects.toThrow(
				InvalidCredentialsError,
			);
		});

		it('rejects a code created for site A when redeemed as site B', async () => {
			const { code } = await issueCode(identitySite);

			await expect(createService().redeemSessionCode('site-chat', code)).rejects.toThrow(InvalidCredentialsError);
		});

		it('rejects codes when the entry authentication mode changed after issuance', async () => {
			const { code } = await issueCode(identitySite);

			queueSettings([{ ...identitySite, authentication: 'directus-api' }]);

			await expect(createService().redeemSessionCode('site-grafana', code)).rejects.toThrow(InvalidCredentialsError);
		});

		it('rejects codes when the user was suspended after issuance', async () => {
			const { code } = await issueCode(identitySite);

			queueSettings([identitySite]);
			queueUsers({ ...mockUser, status: 'suspended' });

			await expect(createService().redeemSessionCode('site-grafana', code)).rejects.toThrow(InvalidCredentialsError);
		});

		it('allows renewal with a fresh code while the session remains valid', async () => {
			const first = await issueCode(apiSite);

			queueSettings([apiSite]);
			queueUsers(mockUser, mockUser, []);
			await createService().redeemSessionCode('site-chat', first.code);

			// Studio session still authenticated: a fresh code can be minted and redeemed.
			const second = await issueCode(apiSite);

			expect(second.code).not.toBe(first.code);

			queueSettings([apiSite]);
			queueUsers(mockUser, mockUser, []);

			const result = await createService().redeemSessionCode('site-chat', second.code);
			expect(result.authentication).toBe('directus-api');
		});
	});
});
