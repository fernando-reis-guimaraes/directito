import { ServiceUnavailableError } from '@directus/errors';
import type { UIMessage } from 'ai';
import { streamText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AISettings } from '../../providers/types.js';
import { createUiStream } from './create-ui-stream.js';

// Mocks
vi.mock('@ai-sdk/openai', () => ({
	createOpenAI: vi.fn(() => (model: string) => ({ id: `openai:${model}` })),
}));

vi.mock('@ai-sdk/anthropic', () => ({
	createAnthropic: vi.fn(() => (model: string) => ({ id: `anthropic:${model}` })),
	anthropic: {
		tools: {
			toolSearchBm25_20251119: vi.fn(() => ({})),
		},
	},
}));

vi.mock('@ai-sdk/google', () => ({
	createGoogleGenerativeAI: vi.fn(() => (model: string) => ({ id: `google:${model}` })),
}));

vi.mock('../constants/system-prompt.js', () => ({
	SYSTEM_PROMPT: 'DEFAULT_SYSTEM_PROMPT',
}));

const mockStreamTextResult = {
	toDataStreamResponse: vi.fn(),
	pipeDataStreamToResponse: vi.fn(),
	toTextStreamResponse: vi.fn(),
	pipeTextStreamToResponse: vi.fn(),
};

vi.mock('ai', () => ({
	streamText: vi.fn(() => mockStreamTextResult),
	convertToModelMessages: vi.fn((messages: UIMessage[]) =>
		Promise.resolve(messages.map((m) => ({ ...m, converted: true }))),
	),
	stepCountIs: vi.fn(),
	createProviderRegistry: vi.fn((providers) => ({
		languageModel: (id: string) => ({ id, providers }),
	})),
}));

describe('createUiStream', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const messages: UIMessage[] = [
		{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
		{ id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi there!' }] },
	];

	const aiSettings: AISettings = {
		openaiApiKey: 'openai-key',
		anthropicApiKey: 'anthropic-key',
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

	it('should create a stream for OpenAI provider', async () => {
		const result = await createUiStream(messages, {
			provider: 'openai',
			model: 'gpt-3.5',
			tools: {},
			aiSettings,
		});

		expect(result).toBe(mockStreamTextResult);
	});

	it('should create a stream for Anthropic provider', async () => {
		const result = await createUiStream(messages, {
			provider: 'anthropic',
			model: 'claude-2',
			tools: {},
			aiSettings,
		});

		expect(result).toBe(mockStreamTextResult);
	});

	it('should throw ServiceUnavailableError if API key is missing for provider', async () => {
		await expect(
			createUiStream(messages, {
				provider: 'openai',
				model: 'gpt-3.5',
				tools: {},
				aiSettings: { ...aiSettings, openaiApiKey: null },
			}),
		).rejects.toThrow(ServiceUnavailableError);

		await expect(
			createUiStream(messages, {
				provider: 'anthropic',
				model: 'claude-2',
				tools: {},
				aiSettings: { ...aiSettings, anthropicApiKey: null },
			}),
		).rejects.toThrow(ServiceUnavailableError);
	});

	it('should throw ServiceUnavailableError for unconfigured provider', async () => {
		await expect(
			createUiStream(messages, {
				provider: 'google',
				model: 'gemini-pro',
				tools: {},
				aiSettings,
			}),
		).rejects.toThrow(ServiceUnavailableError);
	});

	it('uses default system prompt when none provided', async () => {
		await createUiStream(messages, {
			provider: 'openai',
			model: 'gpt-4',
			tools: {},
			aiSettings,
		});

		expect(streamText).toHaveBeenCalledWith(expect.objectContaining({ system: 'DEFAULT_SYSTEM_PROMPT' }));
	});

	it('uses provided system prompt when given', async () => {
		await createUiStream(messages, {
			provider: 'openai',
			model: 'gpt-4o',
			tools: {},
			aiSettings,
			systemPrompt: 'CUSTOM_PROMPT',
		});

		expect(streamText).toHaveBeenCalledWith(expect.objectContaining({ system: 'CUSTOM_PROMPT' }));
	});

	it('replaces empty string system prompt with default', async () => {
		await createUiStream(messages, {
			provider: 'openai',
			model: 'gpt-4o-mini',
			tools: {},
			aiSettings,
			systemPrompt: '',
		});

		expect(streamText).toHaveBeenCalledWith(expect.objectContaining({ system: 'DEFAULT_SYSTEM_PROMPT' }));
	});

	it('passes onUsage callback to streamText onFinish', async () => {
		const onUsage = vi.fn();

		await createUiStream(messages, {
			provider: 'openai',
			model: 'gpt-4',
			tools: {},
			aiSettings,
			onUsage,
		});

		expect(streamText).toHaveBeenCalledWith(
			expect.objectContaining({
				onFinish: expect.any(Function),
			}),
		);

		// Extract and call the onFinish handler to verify it invokes onUsage
		const call = vi.mocked(streamText).mock.calls[0]?.[0];

		const onFinish = call?.onFinish as (result: {
			usage: { inputTokens: number; outputTokens: number; totalTokens: number };
		}) => void;

		onFinish({ usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } });

		expect(onUsage).toHaveBeenCalledWith({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });
	});

	describe('conversation session header', () => {
		const responsesSettings: AISettings = {
			openaiApiKey: null,
			anthropicApiKey: null,
			googleApiKey: null,
			openaiCompatibleApiKey: 'custom-key',
			openaiCompatibleBaseUrl: 'https://opencode.ai/zen/go/v1',
			openaiCompatibleName: 'OpenCode Go',
			openaiCompatibleProtocol: 'responses',
			openaiCompatibleSessionHeader: 'x-opencode-session',
			openaiCompatibleModels: null,
			openaiCompatibleHeaders: null,
			openaiAllowedModels: null,
			anthropicAllowedModels: null,
			googleAllowedModels: null,
			systemPrompt: null,
		};

		it('omits headers when no session header is configured', async () => {
			await createUiStream(messages, {
				provider: 'openai-compatible',
				model: 'custom-model',
				tools: {},
				aiSettings: {
					...responsesSettings,
					openaiCompatibleSessionHeader: null,
				},
				conversationId: 'conv-123',
			});

			const call = vi.mocked(streamText).mock.calls[0]?.[0];
			expect(call).not.toHaveProperty('headers');
		});

		it('omits headers when conversationId is missing', async () => {
			await createUiStream(messages, {
				provider: 'openai-compatible',
				model: 'custom-model',
				tools: {},
				aiSettings: responsesSettings,
			});

			const call = vi.mocked(streamText).mock.calls[0]?.[0];
			expect(call).not.toHaveProperty('headers');
		});

		it('passes the configured session header with the conversation ID', async () => {
			await createUiStream(messages, {
				provider: 'openai-compatible',
				model: 'custom-model',
				tools: {},
				aiSettings: responsesSettings,
				conversationId: 'conv-123',
			});

			expect(streamText).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: { 'x-opencode-session': 'conv-123' },
				}),
			);
		});

		it('keeps the same session header value for repeated calls (stable conversation)', async () => {
			for (let i = 0; i < 2; i++) {
				await createUiStream(messages, {
					provider: 'openai-compatible',
					model: 'custom-model',
					tools: {},
					aiSettings: responsesSettings,
					conversationId: 'conv-stable',
				});
			}

			const calls = vi.mocked(streamText).mock.calls.map((args) => args[0]);

			expect(calls).toHaveLength(2);
			expect(calls[0]).toMatchObject({ headers: { 'x-opencode-session': 'conv-stable' } });
			expect(calls[1]).toMatchObject({ headers: { 'x-opencode-session': 'conv-stable' } });
		});

		it('omits session headers for other providers', async () => {
			await createUiStream(messages, {
				provider: 'openai',
				model: 'gpt-4',
				tools: {},
				aiSettings,
				conversationId: 'conv-123',
			});

			const call = vi.mocked(streamText).mock.calls[0]?.[0];
			expect(call).not.toHaveProperty('headers');
		});
	});
});
