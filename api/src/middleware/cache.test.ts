import { useEnv } from '@directus/env';
import { afterEach, expect, test, vi } from 'vitest';
import { getCacheValue } from '../cache.js';
import { useBufferedCounter } from '../telemetry/counter/use-buffered-counter.js';
import checkCacheMiddleware from './cache.js';

vi.mock('@directus/env', () => ({ useEnv: vi.fn() }));
vi.mock('../cache.js', () => ({ getCache: vi.fn().mockReturnValue({ cache: {} }), getCacheValue: vi.fn() }));
vi.mock('../logger/index.js', () => ({ useLogger: vi.fn().mockReturnValue({ warn: vi.fn() }) }));
vi.mock('../telemetry/counter/use-buffered-counter.js', () => ({ useBufferedCounter: vi.fn() }));
vi.mock('../utils/get-cache-headers.js', () => ({ getCacheControlHeader: vi.fn().mockReturnValue('max-age=60') }));
vi.mock('../utils/get-cache-key.js', () => ({ getCacheKey: vi.fn().mockResolvedValue('cached-key') }));
vi.mock('../utils/should-skip-cache.js', () => ({ shouldSkipCache: vi.fn().mockReturnValue(false) }));

afterEach(() => {
	vi.clearAllMocks();
	vi.useRealTimers();
});

test('Serves cached responses without telemetry counter activity even with TELEMETRY=true', async () => {
	vi.useFakeTimers();
	vi.mocked(useEnv).mockReturnValue({ TELEMETRY: true, CACHE_ENABLED: true, CACHE_STATUS_HEADER: 'X-Cache' });
	const payload = { data: [{ id: 1 }] };

	vi.mocked(getCacheValue)
		.mockResolvedValueOnce(payload)
		.mockResolvedValueOnce({ exp: Date.now() + 60000 });

	const res = { setHeader: vi.fn(), json: vi.fn() };
	const next = vi.fn();

	await checkCacheMiddleware({ method: 'GET', originalUrl: '/items/example' } as any, res as any, next);

	expect(res.json).toHaveBeenCalledExactlyOnceWith(payload);
	expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
	expect(next).not.toHaveBeenCalled();
	expect(useBufferedCounter).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
});
