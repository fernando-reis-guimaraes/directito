import { useEnv } from '@directus/env';
import { afterEach, expect, test, vi } from 'vitest';
import { getCache } from '../cache.js';
import { track } from '../telemetry/index.js';
import { scheduleSynchronizedJob } from '../utils/schedule.js';
import telemetrySchedule from './telemetry.js';

vi.mock('@directus/env', () => ({ useEnv: vi.fn() }));
vi.mock('../cache.js', () => ({ getCache: vi.fn() }));
vi.mock('../telemetry/index.js', () => ({ track: vi.fn() }));
vi.mock('../utils/schedule.js', () => ({ scheduleSynchronizedJob: vi.fn() }));

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

test.each([true, 'true', false, undefined])('Never initializes telemetry with TELEMETRY=%s', async (value) => {
	vi.useFakeTimers();
	vi.stubGlobal('fetch', vi.fn());
	vi.mocked(useEnv).mockReturnValue({ TELEMETRY: value });

	await expect(telemetrySchedule()).resolves.toBe(false);
	await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

	expect(useEnv).not.toHaveBeenCalled();
	expect(getCache).not.toHaveBeenCalled();
	expect(scheduleSynchronizedJob).not.toHaveBeenCalled();
	expect(track).not.toHaveBeenCalled();
	expect(fetch).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
});
