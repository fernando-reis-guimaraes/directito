import type { OwnerInformation } from '@directus/types';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { sendReport } from '../telemetry/index.js';
import { SettingsService } from './settings.js';

const { upsertSingleton, select, update } = vi.hoisted(() => ({
	upsertSingleton: vi.fn(),
	select: vi.fn(),
	update: vi.fn(),
}));

vi.mock('./items.js', () => ({
	ItemsService: class {
		knex = { select, update };
		upsertSingleton = upsertSingleton;
	},
}));

vi.mock('../telemetry/index.js', () => ({ sendReport: vi.fn() }));

const owner: OwnerInformation = {
	project_owner: 'owner@example.com',
	project_usage: 'personal',
	org_name: 'UMA',
	product_updates: false,
};

beforeEach(() => {
	vi.stubEnv('TELEMETRY', 'true');
	vi.stubGlobal('fetch', vi.fn());
	vi.mocked(sendReport).mockRejectedValue(new Error('Reporting must not be attempted'));
});

afterEach(() => {
	vi.resetAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

test('Persists local owner fields without reporting queries or a pending retry', async () => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });
	upsertSingleton.mockResolvedValue('settings-id');

	await expect(service.setOwner(owner)).resolves.toBe('settings-id');
	await Promise.resolve();

	expect(upsertSingleton).toHaveBeenCalledExactlyOnceWith({ ...owner, project_status: null });
	expect(select).not.toHaveBeenCalled();
	expect(update).not.toHaveBeenCalled();
	expect(sendReport).not.toHaveBeenCalled();
	expect(fetch).not.toHaveBeenCalled();
});

test('Preserves local persistence failures without reporting or retry writes', async () => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });
	const error = new Error('Local persistence failed');
	upsertSingleton.mockRejectedValue(error);

	await expect(service.setOwner(owner)).rejects.toBe(error);

	expect(select).not.toHaveBeenCalled();
	expect(update).not.toHaveBeenCalled();
	expect(sendReport).not.toHaveBeenCalled();
	expect(fetch).not.toHaveBeenCalled();
});
