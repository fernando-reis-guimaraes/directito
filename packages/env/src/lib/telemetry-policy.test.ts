import { afterEach, expect, test, vi } from 'vitest';
import { DEFAULTS } from '../constants/defaults.js';
import { isDirectusVariable } from '../utils/is-directus-variable.js';
import { readConfigurationFromProcess } from '../utils/read-configuration-from-process.js';
import { createEnv } from './create-env.js';

vi.mock('../utils/get-config-path.js', () => ({ getConfigPath: vi.fn() }));
vi.mock('../utils/read-configuration-from-process.js', () => ({ readConfigurationFromProcess: vi.fn() }));
vi.mock('./read-configuration-from-file.js', () => ({ readConfigurationFromFile: vi.fn().mockReturnValue({}) }));

afterEach(() => {
	vi.clearAllMocks();
});

test('Defaults telemetry to false', () => {
	vi.mocked(readConfigurationFromProcess).mockReturnValue({});

	expect(DEFAULTS['TELEMETRY']).toBe(false);
	expect(createEnv()['TELEMETRY']).toBe(false);
});

test('Still accepts TELEMETRY=true for upstream compatibility', () => {
	vi.mocked(readConfigurationFromProcess).mockReturnValue({ TELEMETRY: 'true' });

	expect(isDirectusVariable('TELEMETRY')).toBe(true);
	expect(createEnv()['TELEMETRY']).toBe(true);
});
