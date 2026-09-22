import { useEnv } from '@directus/env';
import { ForbiddenError, InvalidCredentialsError, InvalidPayloadError } from '@directus/errors';
import type {
	AbstractServiceOptions,
	EmbeddedSiteAuthentication,
	EmbeddedSiteDisplay,
	SettingsModuleBarLink,
} from '@directus/types';
import type { Knex } from 'knex';
import { nanoid } from 'nanoid';
import { getCache, getCacheValue, setCacheValue } from '../cache.js';
import getDatabase from '../database/index.js';
import { AuthenticationService } from './authentication.js';

const env = useEnv();

/**
 * How long a one-time session bridge code remains redeemable.
 */
export const EMBEDDED_SITE_CODE_TTL_MS = 30_000;

const EMBEDDED_SITE_CODE_PREFIX = 'embedded-site-code:';

/**
 * Only http(s) targets may be embedded. Everything else (javascript:, data:, file:, …)
 * is rejected server-side so a malicious settings value cannot turn the Module Bar
 * into an XSS vector.
 */
const ALLOWED_EMBED_URL_PROTOCOLS = new Set(['http:', 'https:']);

export type EmbeddedSiteIdentity = {
	id: string;
	role: string | null;
	email: string | null;
	first_name: string | null;
	last_name: string | null;
	language: string | null;
};

export type EmbeddedSiteConfig = {
	site: SettingsModuleBarLink;
	display: EmbeddedSiteDisplay;
	authentication: EmbeddedSiteAuthentication;
	origin: string;
};

type StoredSessionCode = {
	userId: string;
	siteId: string;
	authentication: EmbeddedSiteAuthentication;
	expiresAt: number;
};

/**
 * Legacy Module Bar links carry neither `display` nor `authentication`.
 * They keep behaving as plain external links with no session bridge.
 */
export function normalizeEmbeddedLink(link: SettingsModuleBarLink): {
	display: EmbeddedSiteDisplay;
	authentication: EmbeddedSiteAuthentication;
} {
	return {
		display: link.display ?? 'external',
		authentication: link.authentication ?? 'none',
	};
}

export function isEmbeddedLink(link: SettingsModuleBarLink): boolean {
	return normalizeEmbeddedLink(link).display === 'embedded';
}

/**
 * Validate an embeddable URL and return its origin for exact-`targetOrigin` messaging.
 *
 * @throws InvalidPayloadError for malformed URLs or dangerous/disallowed schemes.
 */
export function validateEmbeddedUrl(url: string): { origin: string } {
	let parsed: URL;

	try {
		parsed = new URL(url);
	} catch {
		throw new InvalidPayloadError({ reason: `"url" must be a valid absolute URL` });
	}

	if (ALLOWED_EMBED_URL_PROTOCOLS.has(parsed.protocol) === false) {
		throw new InvalidPayloadError({ reason: `"url" uses a disallowed protocol "${parsed.protocol}"` });
	}

	return { origin: parsed.origin };
}

function sessionCodeKey(code: string): string {
	return `${EMBEDDED_SITE_CODE_PREFIX}${code}`;
}

export class EmbeddedSitesService {
	knex: Knex;
	accountability: AbstractServiceOptions['accountability'];
	schema: AbstractServiceOptions['schema'];

	constructor(options: AbstractServiceOptions) {
		this.knex = options.knex || getDatabase();
		this.accountability = options.accountability || null;
		this.schema = options.schema;
	}

	/**
	 * Resolve an embedded-site entry from the stored `module_bar` configuration.
	 * The server always re-reads the configuration itself; client-supplied
	 * authentication modes or target URLs are never trusted.
	 */
	async resolveEmbeddedSite(siteId: string): Promise<EmbeddedSiteConfig> {
		const settings = await this.knex.select('module_bar').from('directus_settings').where('id', 1).first();

		// Raw knex reads bypass the `cast-json` special applied by the SettingsService,
		// so stored JSON may arrive as a string depending on the database driver.
		const raw = settings?.['module_bar'] as SettingsModuleBarLink[] | string | null | undefined;

		let moduleBar: SettingsModuleBarLink[];

		if (typeof raw === 'string') {
			try {
				moduleBar = JSON.parse(raw) as SettingsModuleBarLink[];
			} catch {
				throw new InvalidPayloadError({ reason: `Embedded site configuration is invalid` });
			}
		} else {
			moduleBar = raw ?? [];
		}

		const site = moduleBar.find((entry) => entry.type === 'link' && entry.id === siteId);

		if (!site || site.enabled === false) {
			throw new InvalidPayloadError({ reason: `Embedded site "${siteId}" is not configured` });
		}

		const { display, authentication } = normalizeEmbeddedLink(site);

		if (display !== 'embedded') {
			throw new InvalidPayloadError({ reason: `Embedded site "${siteId}" is not configured for embedding` });
		}

		const { origin } = validateEmbeddedUrl(site.url);

		return { site, display, authentication, origin };
	}

	/**
	 * Create a one-time session bridge code for the currently authenticated user.
	 * Requires a valid authenticated Studio session (`accountability.user`).
	 */
	async createSessionCode(siteId: string): Promise<{ code: string; expires_in: number }> {
		const userId = this.accountability?.user;

		if (!userId) {
			throw new ForbiddenError();
		}

		const { authentication } = await this.resolveEmbeddedSite(siteId);

		if (authentication === 'none') {
			throw new InvalidPayloadError({ reason: `Embedded site "${siteId}" does not use a session bridge` });
		}

		const code = nanoid(32);

		const { systemCache } = getCache();

		const stored: StoredSessionCode = {
			userId,
			siteId,
			authentication,
			expiresAt: Date.now() + EMBEDDED_SITE_CODE_TTL_MS,
		};

		await setCacheValue(systemCache, sessionCodeKey(code), stored, EMBEDDED_SITE_CODE_TTL_MS);

		return { code, expires_in: EMBEDDED_SITE_CODE_TTL_MS };
	}

	/**
	 * Redeem a one-time session bridge code for identity (and, when configured, a
	 * delegated API access token). The code is single-use: it is deleted before any
	 * credential is issued so it can never be redeemed twice.
	 */
	async redeemSessionCode(
		siteId: string,
		code: string,
	): Promise<
		| { authentication: 'identity'; user: EmbeddedSiteIdentity }
		| {
				authentication: 'directus-api';
				api_url: string;
				access_token: string;
				expires: number;
				user: EmbeddedSiteIdentity;
		  }
	> {
		if (!code || !siteId) {
			throw new InvalidCredentialsError();
		}

		const { systemCache } = getCache();

		const stored = (await getCacheValue(systemCache, sessionCodeKey(code))) as StoredSessionCode | undefined;

		// Single-use: remove the code before doing anything else.
		await systemCache.delete(sessionCodeKey(code));

		if (!stored || stored.siteId !== siteId || stored.expiresAt < Date.now()) {
			throw new InvalidCredentialsError();
		}

		// Re-resolve the configuration server-side so a changed/disabled entry or a
		// changed authentication mode invalidates outstanding codes.
		const { authentication } = await this.resolveEmbeddedSite(siteId);

		if (authentication !== stored.authentication) {
			throw new InvalidCredentialsError();
		}

		const user = await this.fetchIdentity(stored.userId);

		if (authentication === 'identity') {
			return { authentication, user };
		}

		const authenticationService = new AuthenticationService({
			accountability: this.accountability,
			schema: this.schema,
			knex: this.knex,
		});

		const { accessToken, expires } = await authenticationService.issueDelegatedAccessToken(user.id);

		return {
			authentication: 'directus-api',
			api_url: env['PUBLIC_URL'] as string,
			access_token: accessToken,
			expires,
			user,
		};
	}

	/**
	 * Minimal identity snapshot for the session bridge. Only non-sensitive profile
	 * fields are selected — never password hashes, tokens, or TFA secrets — and no
	 * API access token is issued in `identity` mode.
	 */
	private async fetchIdentity(userId: string): Promise<EmbeddedSiteIdentity> {
		const user = await this.knex
			.select('id', 'role', 'email', 'first_name', 'last_name', 'language', 'status')
			.from('directus_users')
			.where('id', userId)
			.first();

		if (!user || user.status !== 'active') {
			throw new InvalidCredentialsError();
		}

		return {
			id: user.id,
			role: user.role,
			email: user.email,
			first_name: user.first_name,
			last_name: user.last_name,
			language: user.language,
		};
	}
}
