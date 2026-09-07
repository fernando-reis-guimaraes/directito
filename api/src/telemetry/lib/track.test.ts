import { setTimeout } from 'timers/promises';
import { afterEach, expect, test, vi } from 'vitest';
import { useLogger } from '../../logger/index.js';
import { getReport } from './get-report.js';
import { sendReport } from './send-report.js';
import { track } from './track.js';

vi.mock('./get-report.js', () => ({ getReport: vi.fn() }));
vi.mock('./send-report.js', () => ({ sendReport: vi.fn() }));
vi.mock('timers/promises', () => ({ setTimeout: vi.fn() }));
vi.mock('../../logger/index.js', () => ({ useLogger: vi.fn() }));

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

test.each([undefined, { wait: true }, { wait: false }])('Does no reporting work with options %j', async (options) => {
	vi.stubEnv('TELEMETRY', 'true');
	vi.stubGlobal('fetch', vi.fn());

	await expect(track(options)).resolves.toBe(false);

	expect(getReport).not.toHaveBeenCalled();
	expect(sendReport).not.toHaveBeenCalled();
	expect(setTimeout).not.toHaveBeenCalled();
	expect(useLogger).not.toHaveBeenCalled();
	expect(fetch).not.toHaveBeenCalled();
});
