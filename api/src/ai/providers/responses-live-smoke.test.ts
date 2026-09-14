/**
 * Live smoke test through the actual Directus provider path against OpenCode Go.
 *
 * Runs ONLY when X_OPENCODE_GO_CLASSLOG_API_KEY is set; otherwise the suite is
 * skipped with an explicit message. The key value is never logged, snapshotted,
 * or persisted anywhere by this test.
 */
import { randomUUID } from 'node:crypto';
import { tool } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createUiStream } from '../chat/lib/create-ui-stream.js';
import type { AISettings } from './types.js';

const API_KEY = process.env['X_OPENCODE_GO_CLASSLOG_API_KEY'];
const LIVE = Boolean(API_KEY);

if (!LIVE) {
	// eslint-disable-next-line no-console -- required: visibly report the live-test skip reason in CI output
	console.log('LIVE TEST SKIPPED: X_OPENCODE_GO_CLASSLOG_API_KEY not set');
}

const liveSettings = (): AISettings => ({
	openaiApiKey: null,
	anthropicApiKey: null,
	googleApiKey: null,
	openaiCompatibleApiKey: API_KEY ?? 'missing',
	openaiCompatibleBaseUrl: 'https://opencode.ai/zen/go/v1',
	openaiCompatibleName: 'OpenCode Go',
	openaiCompatibleProtocol: 'responses',
	openaiCompatibleSessionHeader: 'x-opencode-session',
	openaiCompatibleModels: null,
	openaiCompatibleHeaders: [{ header: 'User-Agent', value: 'directito-classlog-ai/1.0' }],
	openaiAllowedModels: null,
	anthropicAllowedModels: null,
	googleAllowedModels: null,
	systemPrompt: null,
});

const userMessage = (text: string) => [
	{ id: randomUUID(), role: 'user' as const, parts: [{ type: 'text' as const, text }] },
];

describe.skipIf(!LIVE)('opencode go live smoke (directus provider path)', () => {
	it('resolves provider+model, authenticates over /responses, and sustains two turns', async () => {
		const conversationId = randomUUID();

		const first = await createUiStream(userMessage('Respond only with OK.'), {
			provider: 'openai-compatible',
			model: 'muse-spark-1.3-contributor',
			tools: {},
			aiSettings: liveSettings(),
			conversationId,
		});

		const firstText = (await first.text).trim();
		expect(firstText.length).toBeGreaterThan(0);

		const second = await createUiStream(userMessage('Respond only with OK again.'), {
			provider: 'openai-compatible',
			model: 'muse-spark-1.3-contributor',
			tools: {
				ping: tool({
					description: 'Reply with pong',
					inputSchema: z.object({}),
					execute: async () => 'pong',
				}),
			},
			aiSettings: liveSettings(),
			conversationId,
		});

		const secondText = (await second.text).trim();
		expect(secondText.length).toBeGreaterThan(0);
	}, 120_000);
});
