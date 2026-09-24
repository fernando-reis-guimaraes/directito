import { InvalidPayloadError } from '@directus/errors';
import type {
	AbstractServiceOptions,
	Item,
	MutationOptions,
	OwnerInformation,
	PrimaryKey,
} from '@directus/types';
import { normalizeHomepagePath } from '@directus/utils';
import { ItemsService } from './items.js';

export class SettingsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_settings', options);
	}

	async setOwner(data: OwnerInformation) {
		// UMA fork policy: outbound Directus telemetry and compliance reporting are intentionally disabled.
		return await this.upsertSingleton({
			project_owner: data.project_owner,
			project_usage: data.project_usage,
			org_name: data.org_name,
			product_updates: data.product_updates,
			project_status: null,
		});
	}

	override async createOne(data: Partial<Item>, opts: MutationOptions = {}): Promise<PrimaryKey> {
		return await super.createOne(this.withValidatedHomepagePath(data), opts);
	}

	override async updateMany(
		keys: PrimaryKey[],
		data: Partial<Item>,
		opts: MutationOptions = {},
	): Promise<PrimaryKey[]> {
		return await super.updateMany(keys, this.withValidatedHomepagePath(data), opts);
	}

	/**
	 * Reject invalid `homepage_path` values before they are persisted, so the
	 * administrator gets an immediate error instead of a silently ignored value.
	 *
	 * `null`/empty means "disabled" and is stored as `null`; valid values are
	 * stored trimmed. Anything else throws an `InvalidPayloadError`.
	 */
	private withValidatedHomepagePath(data: Partial<Item>): Partial<Item> {
		if ('homepage_path' in data === false) return data;

		const value = data['homepage_path'];

		if (value === undefined || value === null) return data;

		if (typeof value !== 'string') {
			throw new InvalidPayloadError({ reason: `"homepage_path" must be a string or null` });
		}

		if (value.trim() === '') return { ...data, homepage_path: null };

		const normalized = normalizeHomepagePath(value);

		if (normalized === null) {
			throw new InvalidPayloadError({
				reason: `"homepage_path" must be an internal Data Studio path starting with a single "/" (e.g. "/content" or "/embedded/site-id"). Received: ${JSON.stringify(value)}`,
			});
		}

		if (normalized !== value) return { ...data, homepage_path: normalized };

		return data;
	}
}
