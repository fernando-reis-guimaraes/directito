import { useEnv } from '@directus/env';
import { afterEach, expect, test, vi } from 'vitest';
import type { TelemetryReport } from '../types/report.js';
import { type OwnerReport, sendReport } from './send-report.js';

vi.mock('@directus/env', () => ({ useEnv: vi.fn() }));

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

const ownerReport: OwnerReport = {
	project_owner: 'owner@example.com',
	version: '1.0.0',
	org_name: 'UMA',
	product_updates: false,
	project_id: 'local-project',
	project_usage: 'personal',
};

test.each([true, 'true', false, undefined])('Never sends either report with TELEMETRY=%s', async (value) => {
	vi.stubEnv('TELEMETRY', String(value));
	vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network must not be used')));

	vi.mocked(useEnv).mockReturnValue({
		TELEMETRY: value,
		TELEMETRY_URL: 'https://telemetry.directus.io',
		COMPLIANCE_URL: 'https://telemetry.directus.io',
		TELEMETRY_AUTHORIZATION: 'test-auth',
	});

	await expect(sendReport({} as TelemetryReport)).resolves.toBeUndefined();
	await expect(sendReport(ownerReport)).resolves.toBeUndefined();

	expect(useEnv).not.toHaveBeenCalled();
	expect(fetch).not.toHaveBeenCalled();
});
