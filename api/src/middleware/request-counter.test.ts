import { useEnv } from '@directus/env';
import { afterEach, expect, test, vi } from 'vitest';
import { useBufferedCounter } from '../telemetry/counter/use-buffered-counter.js';
import requestCounterMiddleware from './request-counter.js';

vi.mock('@directus/env', () => ({ useEnv: vi.fn().mockReturnValue({ TELEMETRY: true }) }));
vi.mock('../telemetry/counter/use-buffered-counter.js', () => ({ useBufferedCounter: vi.fn() }));

afterEach(() => {
	vi.clearAllMocks();
	vi.useRealTimers();
});

test.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'PURGE'])(
	'Passes through %s without telemetry infrastructure',
	(method) => {
		vi.useFakeTimers();
		const next = vi.fn();

		requestCounterMiddleware({ method } as any, {} as any, next);

		expect(next).toHaveBeenCalledExactlyOnceWith();
		expect(useEnv).not.toHaveBeenCalled();
		expect(useBufferedCounter).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	},
);
