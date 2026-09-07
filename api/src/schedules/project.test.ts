import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { afterEach, expect, test, vi } from 'vitest';
import getDatabase from '../database/index.js';
import { sendReport } from '../telemetry/index.js';
import { scheduleSynchronizedJob } from '../utils/schedule.js';
import projectSchedule from './project.js';

vi.mock('../database/index.js', () => ({ default: vi.fn() }));
vi.mock('../telemetry/index.js', () => ({ sendReport: vi.fn() }));
vi.mock('../utils/schedule.js', () => ({ scheduleSynchronizedJob: vi.fn() }));

const db = knex({ client: MockClient });
const tracker = createTracker(db);

afterEach(() => {
	tracker.reset();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

test.each(['pending', null])(
	'Leaves project_status=%s inert without database or scheduled activity',
	async (status) => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn());
		vi.mocked(getDatabase).mockReturnValue(db);
		tracker.on.select('directus_settings').response([{ project_status: status }]);

		await expect(projectSchedule()).resolves.toBeUndefined();
		await vi.advanceTimersByTimeAsync(48 * 60 * 60 * 1000);

		expect(getDatabase).not.toHaveBeenCalled();
		expect(tracker.history.all).toEqual([]);
		expect(scheduleSynchronizedJob).not.toHaveBeenCalled();
		expect(sendReport).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	},
);
