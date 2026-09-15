import { beforeEach, expect, type MockInstance, test, vi } from 'vitest';
import { updateCheck } from './index.js';

let consoleMock: MockInstance;

beforeEach(() => {
	consoleMock = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

test('Update check is disabled and never prints or fetches', async () => {
	await updateCheck('10.5.0');

	expect(consoleMock).not.toHaveBeenCalled();
});

test('Do not fail on empty response', async () => {
	await updateCheck('10.5.0');

	expect(consoleMock).not.toHaveBeenCalled();
});
