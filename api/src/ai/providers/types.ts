import type { OpenAICompatibleHeader, OpenAICompatibleModel, OpenAICompatibleProtocol } from '@directus/ai';

interface OpenAIConfig {
	type: 'openai';
	apiKey: string;
}

interface AnthropicConfig {
	type: 'anthropic';
	apiKey: string;
}

interface GoogleConfig {
	type: 'google';
	apiKey: string;
}

interface OpenAICompatibleConfig {
	type: 'openai-compatible';
	apiKey: string;
	baseUrl: string;
	protocol: OpenAICompatibleProtocol;
}

export type ProviderConfig = OpenAIConfig | AnthropicConfig | GoogleConfig | OpenAICompatibleConfig;

export interface AISettings {
	openaiApiKey: string | null;
	anthropicApiKey: string | null;
	googleApiKey: string | null;
	openaiCompatibleApiKey: string | null;
	openaiCompatibleBaseUrl: string | null;
	openaiCompatibleName: string | null;
	openaiCompatibleProtocol: OpenAICompatibleProtocol | null;
	openaiCompatibleSessionHeader: string | null;
	openaiCompatibleModels: OpenAICompatibleModel[] | null;
	openaiCompatibleHeaders: OpenAICompatibleHeader[] | null;
	openaiAllowedModels: string[] | null;
	anthropicAllowedModels: string[] | null;
	googleAllowedModels: string[] | null;
	systemPrompt: string | null;
}
