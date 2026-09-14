import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createProviderRegistry } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnthropicWithFileSupport } from './anthropic-file-support.js';
import { buildProviderConfigs, createAIProviderRegistry, resolveOpenAICompatibleProtocol } from './registry.js';
import type { AISettings, ProviderConfig } from './types.js';

vi.mock('@ai-sdk/openai', () => ({
	createOpenAI: vi.fn(() => ({ languageModel: vi.fn() })),
}));

vi.mock('./anthropic-file-support.js', () => ({
	createAnthropicWithFileSupport: vi.fn(() => ({ languageModel: vi.fn() })),
}));

vi.mock('@ai-sdk/google', () => ({
	createGoogleGenerativeAI: vi.fn(() => ({ languageModel: vi.fn() })),
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
	createOpenAICompatible: vi.fn(() => ({ languageModel: vi.fn() })),
}));

vi.mock('ai', () => ({
	createProviderRegistry: vi.fn(() => ({
		languageModel: vi.fn(),
	})),
}));

const baseSettings: AISettings = {
	openaiApiKey: null,
	anthropicApiKey: null,
	googleApiKey: null,
	openaiCompatibleApiKey: null,
	openaiCompatibleBaseUrl: null,
	openaiCompatibleName: null,
	openaiCompatibleProtocol: null,
	openaiCompatibleSessionHeader: null,
	openaiCompatibleModels: null,
	openaiCompatibleHeaders: null,
	openaiAllowedModels: null,
	anthropicAllowedModels: null,
	googleAllowedModels: null,
	systemPrompt: null,
};

describe('buildProviderConfigs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns empty array when no providers configured', () => {
		const configs = buildProviderConfigs(baseSettings);
		expect(configs).toEqual([]);
	});

	it('includes OpenAI when API key is set', () => {
		const configs = buildProviderConfigs({
			...baseSettings,
			openaiApiKey: 'sk-openai-key',
		});

		expect(configs).toHaveLength(1);
		expect(configs[0]).toEqual({ type: 'openai', apiKey: 'sk-openai-key' });
	});

	it('includes Anthropic when API key is set', () => {
		const configs = buildProviderConfigs({
			...baseSettings,
			anthropicApiKey: 'sk-anthropic-key',
		});

		expect(configs).toHaveLength(1);
		expect(configs[0]).toEqual({ type: 'anthropic', apiKey: 'sk-anthropic-key' });
	});

	it('includes Google when API key is set', () => {
		const configs = buildProviderConfigs({
			...baseSettings,
			googleApiKey: 'google-api-key',
		});

		expect(configs).toHaveLength(1);
		expect(configs[0]).toEqual({ type: 'google', apiKey: 'google-api-key' });
	});

	it('includes OpenAI-compatible only when both API key and base URL are set', () => {
		const configs = buildProviderConfigs({
			...baseSettings,
			openaiCompatibleApiKey: 'custom-key',
			openaiCompatibleBaseUrl: 'http://localhost:11434/v1',
		});

		expect(configs).toHaveLength(1);

		expect(configs[0]).toEqual({
			type: 'openai-compatible',
			apiKey: 'custom-key',
			baseUrl: 'http://localhost:11434/v1',
			protocol: 'chat-completions',
		});
	});

	it('excludes OpenAI-compatible when only API key is set', () => {
		const configs = buildProviderConfigs({
			...baseSettings,
			openaiCompatibleApiKey: 'custom-key',
		});

		expect(configs).toHaveLength(0);
	});

	it('excludes OpenAI-compatible when only base URL is set', () => {
		const configs = buildProviderConfigs({
			...baseSettings,
			openaiCompatibleBaseUrl: 'http://localhost:11434/v1',
		});

		expect(configs).toHaveLength(0);
	});

	it('includes multiple providers when configured', () => {
		const configs = buildProviderConfigs({
			...baseSettings,
			openaiApiKey: 'sk-openai',
			anthropicApiKey: 'sk-anthropic',
			googleApiKey: 'google-key',
			openaiCompatibleApiKey: 'custom-key',
			openaiCompatibleBaseUrl: 'http://localhost:11434/v1',
		});

		expect(configs).toHaveLength(4);
		expect(configs.map((c) => c.type)).toEqual(['openai', 'anthropic', 'google', 'openai-compatible']);
	});
});

describe('createAIProviderRegistry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates registry with OpenAI provider', () => {
		const configs: ProviderConfig[] = [{ type: 'openai', apiKey: 'sk-test' }];
		createAIProviderRegistry(configs);
		expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test' });
	});

	it('creates registry with Anthropic provider', () => {
		const configs: ProviderConfig[] = [{ type: 'anthropic', apiKey: 'sk-anthropic' }];
		createAIProviderRegistry(configs);
		expect(createAnthropicWithFileSupport).toHaveBeenCalledWith('sk-anthropic');
	});

	it('creates registry with Google provider', () => {
		const configs: ProviderConfig[] = [{ type: 'google', apiKey: 'google-key' }];
		createAIProviderRegistry(configs);
		expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'google-key' });
	});

	it('creates registry with OpenAI-compatible provider', () => {
		const configs: ProviderConfig[] = [
			{ type: 'openai-compatible', apiKey: 'custom-key', baseUrl: 'http://localhost:11434/v1' },
		];

		createAIProviderRegistry(configs);

		expect(createOpenAICompatible).toHaveBeenCalledWith({
			name: 'openai-compatible',
			apiKey: 'custom-key',
			baseURL: 'http://localhost:11434/v1',
			headers: {},
		});
	});

	it('uses custom name for OpenAI-compatible provider when provided in settings', () => {
		const configs: ProviderConfig[] = [
			{ type: 'openai-compatible', apiKey: 'custom-key', baseUrl: 'http://localhost:11434/v1' },
		];

		const settings: AISettings = {
			...baseSettings,
			openaiCompatibleApiKey: 'custom-key',
			openaiCompatibleBaseUrl: 'http://localhost:11434/v1',
			openaiCompatibleName: 'Ollama',
		};

		createAIProviderRegistry(configs, settings);
		expect(createOpenAICompatible).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ollama' }));
	});

	it('uses custom headers for OpenAI-compatible provider when provided in settings', () => {
		const configs: ProviderConfig[] = [
			{ type: 'openai-compatible', apiKey: 'custom-key', baseUrl: 'http://localhost:11434/v1' },
		];

		const settings: AISettings = {
			...baseSettings,
			openaiCompatibleApiKey: 'custom-key',
			openaiCompatibleBaseUrl: 'http://localhost:11434/v1',
			openaiCompatibleHeaders: [
				{ header: 'X-Custom-Header', value: 'custom-value' },
				{ header: 'Authorization', value: 'Bearer token123' },
			],
		};

		createAIProviderRegistry(configs, settings);

		expect(createOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: {
					'X-Custom-Header': 'custom-value',
					Authorization: 'Bearer token123',
				},
			}),
		);
	});

	it('skips OpenAI-compatible when baseUrl is missing', () => {
		const configs = [{ type: 'openai-compatible', apiKey: 'custom-key' }] as ProviderConfig[];
		createAIProviderRegistry(configs);
		expect(createOpenAICompatible).not.toHaveBeenCalled();
	});

	it('creates registry with multiple providers', () => {
		const configs: ProviderConfig[] = [
			{ type: 'openai', apiKey: 'sk-openai' },
			{ type: 'anthropic', apiKey: 'sk-anthropic' },
			{ type: 'google', apiKey: 'google-key' },
		];

		createAIProviderRegistry(configs);
		expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-openai' });
		expect(createAnthropicWithFileSupport).toHaveBeenCalledWith('sk-anthropic');
		expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'google-key' });
	});
});

describe('resolveOpenAICompatibleProtocol', () => {
	it('defaults to chat-completions when protocol is null (legacy settings)', () => {
		expect(resolveOpenAICompatibleProtocol(null)).toBe('chat-completions');
	});

	it('defaults to chat-completions when protocol is undefined', () => {
		expect(resolveOpenAICompatibleProtocol(undefined as any)).toBe('chat-completions');
	});

	it('keeps explicit chat-completions', () => {
		expect(resolveOpenAICompatibleProtocol('chat-completions')).toBe('chat-completions');
	});

	it('keeps explicit responses', () => {
		expect(resolveOpenAICompatibleProtocol('responses')).toBe('responses');
	});

	it('falls back to chat-completions for unknown values', () => {
		expect(resolveOpenAICompatibleProtocol('other' as any)).toBe('chat-completions');
	});
});

describe('openai-compatible protocol', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('buildProviderConfigs defaults to chat-completions for legacy settings', () => {
		const configs = buildProviderConfigs({
			...baseSettings,
			openaiCompatibleApiKey: 'custom-key',
			openaiCompatibleBaseUrl: 'http://localhost:11434/v1',
		});

		expect(configs).toHaveLength(1);

		expect(configs[0]).toEqual({
			type: 'openai-compatible',
			apiKey: 'custom-key',
			baseUrl: 'http://localhost:11434/v1',
			protocol: 'chat-completions',
		});
	});

	it('buildProviderConfigs keeps explicit responses protocol', () => {
		const configs = buildProviderConfigs({
			...baseSettings,
			openaiCompatibleApiKey: 'custom-key',
			openaiCompatibleBaseUrl: 'https://opencode.ai/zen/go/v1',
			openaiCompatibleProtocol: 'responses',
		});

		expect(configs).toHaveLength(1);

		expect(configs[0]).toEqual({
			type: 'openai-compatible',
			apiKey: 'custom-key',
			baseUrl: 'https://opencode.ai/zen/go/v1',
			protocol: 'responses',
		});
	});

	it('uses Chat Completions transport when protocol is missing (backward compatible)', () => {
		const configs: ProviderConfig[] = [
			{ type: 'openai-compatible', apiKey: 'custom-key', baseUrl: 'http://localhost:11434/v1' } as ProviderConfig,
		];

		createAIProviderRegistry(configs);

		expect(createOpenAICompatible).toHaveBeenCalledWith({
			name: 'openai-compatible',
			apiKey: 'custom-key',
			baseURL: 'http://localhost:11434/v1',
			headers: {},
		});

		expect(createOpenAI).not.toHaveBeenCalled();
	});

	it('uses Responses transport via @ai-sdk/openai when protocol is responses', () => {
		const responses = vi.fn((modelId: string) => ({ id: `responses:${modelId}` }));
		vi.mocked(createOpenAI).mockReturnValue({ responses } as any);

		const configs: ProviderConfig[] = [
			{
				type: 'openai-compatible',
				apiKey: 'custom-key',
				baseUrl: 'https://opencode.ai/zen/go/v1',
				protocol: 'responses',
			},
		];

		const settings: AISettings = {
			...baseSettings,
			openaiCompatibleApiKey: 'custom-key',
			openaiCompatibleBaseUrl: 'https://opencode.ai/zen/go/v1',
			openaiCompatibleProtocol: 'responses',
			openaiCompatibleHeaders: [{ header: 'User-Agent', value: 'directito-classlog-ai/1.0' }],
		};

		const registry: any = createAIProviderRegistry(configs, settings);

		expect(createOpenAI).toHaveBeenCalledWith({
			apiKey: 'custom-key',
			baseURL: 'https://opencode.ai/zen/go/v1',
			headers: { 'User-Agent': 'directito-classlog-ai/1.0' },
		});

		expect(createOpenAICompatible).not.toHaveBeenCalled();

		// The registered provider resolves models through the explicit `.responses()` entry point
		const registered = vi.mocked(createProviderRegistry).mock.calls[0]?.[0] as any;
		registered['openai-compatible'].languageModel('muse-spark-1.3-contributor');
		expect(responses).toHaveBeenCalledWith('muse-spark-1.3-contributor');
		expect(registry).toBeDefined();
	});
});
