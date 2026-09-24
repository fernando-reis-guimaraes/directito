import type { OwnerInformation } from '@directus/types';
import { InvalidPayloadError } from '@directus/errors';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { sendReport } from '../telemetry/index.js';
import { SettingsService } from './settings.js';

const { upsertSingleton, select, update, createOne, updateMany } = vi.hoisted(() => ({
	upsertSingleton: vi.fn(),
	select: vi.fn(),
	update: vi.fn(),
	createOne: vi.fn(),
	updateMany: vi.fn(),
}));

vi.mock('./items.js', () => ({
	ItemsService: class {
		knex = { select, update };
		upsertSingleton = upsertSingleton;
		createOne = createOne;
		updateMany = updateMany;
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

test('createOne persists a valid homepage_path unchanged', async () => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });
	createOne.mockResolvedValue(1);

	await expect(service.createOne({ homepage_path: '/embedded/site-id' })).resolves.toBe(1);
	expect(createOne).toHaveBeenCalledExactlyOnceWith({ homepage_path: '/embedded/site-id' }, {});
});

test('createOne trims a valid homepage_path before persisting', async () => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });
	createOne.mockResolvedValue(1);

	await expect(service.createOne({ homepage_path: '  /content  ' })).resolves.toBe(1);
	expect(createOne).toHaveBeenCalledExactlyOnceWith({ homepage_path: '/content' }, {});
});

test('createOne stores null for an empty homepage_path', async () => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });
	createOne.mockResolvedValue(1);

	await expect(service.createOne({ homepage_path: '   ' })).resolves.toBe(1);
	expect(createOne).toHaveBeenCalledExactlyOnceWith({ homepage_path: null }, {});
});

test('createOne passes data without homepage_path through untouched', async () => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });
	createOne.mockResolvedValue(1);

	await expect(service.createOne({ project_name: 'Test' })).resolves.toBe(1);
	expect(createOne).toHaveBeenCalledExactlyOnceWith({ project_name: 'Test' }, {});
});

test.each([
	'https://example.com',
	'http://example.com',
	'//example.com',
	'javascript:alert(1)',
	'data:text/html,hi',
	'/\\example.com',
	'/content\\foo',
	'content',
])('createOne rejects invalid homepage_path %p before persisting', async (homepage_path) => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });

	await expect(service.createOne({ homepage_path })).rejects.toBeInstanceOf(InvalidPayloadError);
	expect(createOne).not.toHaveBeenCalled();
});

test('updateMany rejects an invalid homepage_path before persisting', async () => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });

	await expect(service.updateMany([1], { homepage_path: 'https://example.com' })).rejects.toBeInstanceOf(
		InvalidPayloadError,
	);
	expect(updateMany).not.toHaveBeenCalled();
});

test('updateMany persists a valid homepage_path', async () => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });
	updateMany.mockResolvedValue([1]);

	await expect(service.updateMany([1], { homepage_path: '/content/turmas/123?tab=alunos#lista' })).resolves.toEqual([
		1,
	]);
	expect(updateMany).toHaveBeenCalledExactlyOnceWith([1], { homepage_path: '/content/turmas/123?tab=alunos#lista' }, {});
});

test('updateMany allows null homepage_path (disabled)', async () => {
	const service = new SettingsService({ schema: { collections: {}, relations: [] } });
	updateMany.mockResolvedValue([1]);

	await expect(service.updateMany([1], { homepage_path: null })).resolves.toEqual([1]);
	expect(updateMany).toHaveBeenCalledExactlyOnceWith([1], { homepage_path: null }, {});
});
