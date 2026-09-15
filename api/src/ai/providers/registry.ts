import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { OpenAICompatibleProtocol } from '@directus/ai';
import { createProviderRegistry } from 'ai';
import { createAnthropicWithFileSupport } from './anthropic-file-support.js';
import type { AISettings, ProviderConfig } from './types.js';

type ProviderRegistry = ReturnType<typeof createProviderRegistry>;

/**
 * Resolve the transport for the OpenAI-Compatible provider.
 * Anything that is not explicitly 'responses' (including null from legacy
 * installations) falls back to Chat Completions for backward compatibility.
 */
export function resolveOpenAICompatibleProtocol(
	protocol: AISettings['openaiCompatibleProtocol'],
): OpenAICompatibleProtocol {
	return protocol === 'responses' ? 'responses' : 'chat-completions';
}

export function buildProviderConfigs(settings: AISettings): ProviderConfig[] {
	const configs: ProviderConfig[] = [];

	if (settings.openaiApiKey) {
		configs.push({
			type: 'openai',
			apiKey: settings.openaiApiKey,
		});
	}

	if (settings.anthropicApiKey) {
		configs.push({
			type: 'anthropic',
			apiKey: settings.anthropicApiKey,
		});
	}

	if (settings.googleApiKey) {
		configs.push({
			type: 'google',
			apiKey: settings.googleApiKey,
		});
	}

	if (settings.openaiCompatibleApiKey && settings.openaiCompatibleBaseUrl) {
		configs.push({
			type: 'openai-compatible',
			apiKey: settings.openaiCompatibleApiKey,
			baseUrl: settings.openaiCompatibleBaseUrl,
			protocol: resolveOpenAICompatibleProtocol(settings.openaiCompatibleProtocol),
		});
	}

	return configs;
}

export function createAIProviderRegistry(configs: ProviderConfig[], settings?: AISettings): ProviderRegistry {
	const providers: Parameters<typeof createProviderRegistry>[0] = {};

	for (const config of configs) {
		switch (config.type) {
			case 'openai':
				providers['openai'] = createOpenAI({ apiKey: config.apiKey });
				break;
			case 'anthropic':
				providers['anthropic'] = createAnthropicWithFileSupport(config.apiKey);
				break;
			case 'google':
				providers['google'] = createGoogleGenerativeAI({ apiKey: config.apiKey });
				break;
			case 'openai-compatible':
				if (config.baseUrl) {
					const customHeaders = Object.fromEntries(
						settings?.openaiCompatibleHeaders?.map(({ header, value }) => [header, value]) ?? [],
					);

					const protocol = config.protocol ?? resolveOpenAICompatibleProtocol(settings?.openaiCompatibleProtocol);

					if (protocol === 'responses') {
						// Responses API via @ai-sdk/openai against the configured custom base URL.
						// The Responses model appends `/responses` to the base URL itself.
						// Use the explicit `.responses()` entry point rather than relying on
						// the provider's default callable.
						const openaiProvider = createOpenAI({
							apiKey: config.apiKey,
							baseURL: config.baseUrl,
							headers: customHeaders,
						});

						const responsesProvider = {
							specificationVersion: 'v3' as const,
							languageModel: (modelId: string) => openaiProvider.responses(modelId),
						};

						providers['openai-compatible'] = responsesProvider;
					} else {
						providers['openai-compatible'] = createOpenAICompatible({
							name: settings?.openaiCompatibleName ?? 'openai-compatible',
							apiKey: config.apiKey,
							baseURL: config.baseUrl,
							headers: customHeaders,
						});
					}
				}

				break;
		}
	}

	return createProviderRegistry(providers);
}
