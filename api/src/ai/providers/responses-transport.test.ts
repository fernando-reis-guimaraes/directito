/**
 * Local transport test for the OpenAI-Compatible Responses mode.
 *
 * Uses the REAL Directus provider path (buildProviderConfigs ->
 * createAIProviderRegistry -> createUiStream -> streamText -> @ai-sdk/openai)
 * against a local mock HTTP server, and asserts on the ACTUAL outbound HTTP
 * requests produced by the Vercel AI SDK. Nothing is mocked except the remote
 * endpoint itself.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { tool } from 'ai';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createUiStream } from '../chat/lib/create-ui-stream.js';
import type { AISettings } from './types.js';

interface CapturedRequest {
	method: string | undefined;
	url: string | undefined;
	headers: Record<string, string | string[] | undefined>;
	body: any;
}

const captured: CapturedRequest[] = [];
let server: Server;
let baseUrl: string;

const sse = (events: object[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n';

const createdEvent = (id: string) => ({
	type: 'response.created',
	response: { id, created_at: 1, model: 'mock-model' },
});

const completedEvent = () => ({
	type: 'response.completed',
	response: { usage: { input_tokens: 10, output_tokens: 5 } },
});

const textTurnEvents = (text: string) => [
	createdEvent('resp_text'),
	{ type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'msg_1' } },
	{ type: 'response.output_text.delta', item_id: 'msg_1', delta: text },
	{ type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'msg_1' } },
	completedEvent(),
];

const toolCallTurnEvents = () => [
	createdEvent('resp_tool'),
	{
		type: 'response.output_item.added',
		output_index: 0,
		item: { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'getTime', arguments: '' },
	},
	{ type: 'response.function_call_arguments.delta', item_id: 'fc_1', output_index: 0, delta: '{}' },
	{
		type: 'response.output_item.done',
		output_index: 0,
		item: {
			type: 'function_call',
			id: 'fc_1',
			call_id: 'call_1',
			name: 'getTime',
			arguments: '{}',
			status: 'completed',
		},
	},
	completedEvent(),
];

function inputContainsFunctionOutput(input: unknown): boolean {
	return JSON.stringify(input ?? '').includes('function_call_output');
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
	let raw = '';

	req.on('data', (chunk) => (raw += chunk));

	req.on('end', () => {
		const body = raw ? JSON.parse(raw) : null;

		captured.push({
			method: req.method,
			url: req.url,
			headers: req.headers as Record<string, string | string[] | undefined>,
			body,
		});

		const events = inputContainsFunctionOutput(body?.input)
			? textTurnEvents('The time is noon.')
			: toolCallTurnEvents();

		res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
		res.end(sse(events));
	});
}

beforeAll(async () => {
	server = createServer(handleRequest);

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

	const { port } = server.address() as AddressInfo;
	baseUrl = `http://127.0.0.1:${port}/v1`;
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

const responsesSettings = (): AISettings => ({
	openaiApiKey: null,
	anthropicApiKey: null,
	googleApiKey: null,
	openaiCompatibleApiKey: 'test-key',
	openaiCompatibleBaseUrl: baseUrl,
	openaiCompatibleName: 'Mock Responses',
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
	{ id: `msg-${text}`, role: 'user' as const, parts: [{ type: 'text' as const, text }] },
];

const getTimeTool = () =>
	tool({
		description: 'Get the current time',
		inputSchema: z.object({}),
		execute: async () => 'noon',
	});

describe('responses transport (live HTTP)', () => {
	it('POSTs to /v1/responses with auth, user-agent and stable session header across a tool-call loop', async () => {
		captured.length = 0;
		const conversationId = `conv-${Date.now()}`;

		const stream = await createUiStream(userMessage('what time is it?'), {
			provider: 'openai-compatible',
			model: 'mock-model',
			tools: { getTime: getTimeTool() },
			aiSettings: responsesSettings(),
			conversationId,
		});

		const text = await stream.text;
		expect(text).toContain('noon');

		// Tool-call round trip = 2 model requests in the same streamText invocation
		expect(captured.length).toBe(2);

		for (const req of captured) {
			expect(req.method).toBe('POST');
			expect(req.url).toBe('/v1/responses');
			expect(req.url).not.toContain('chat/completions');
			// Authorization must be sent, but its value must never be snapshotted
			expect(req.headers['authorization']).toBeTruthy();
			// The SDK appends its own suffix; the configured value must lead
			expect(String(req.headers['user-agent'])).toMatch(/^directito-classlog-ai\/1\.0/);

			const session = req.headers['x-opencode-session'];
			expect(typeof session).toBe('string');
			expect((session as string).length).toBeGreaterThan(0);
			expect(session).toBe(conversationId);
		}
	}, 30_000);

	it('keeps the session ID across turns and rotates it for a new conversation', async () => {
		captured.length = 0;
		const firstConversation = `conv-a-${Date.now()}`;

		const first = await createUiStream(userMessage('first turn'), {
			provider: 'openai-compatible',
			model: 'mock-model',
			tools: { getTime: getTimeTool() },
			aiSettings: responsesSettings(),
			conversationId: firstConversation,
		});

		await first.text;

		const second = await createUiStream(userMessage('second turn'), {
			provider: 'openai-compatible',
			model: 'mock-model',
			tools: { getTime: getTimeTool() },
			aiSettings: responsesSettings(),
			conversationId: firstConversation,
		});

		await second.text;

		const turnSessions = captured.map((req) => req.headers['x-opencode-session']);
		expect(turnSessions.length).toBeGreaterThan(0);

		for (const session of turnSessions) {
			expect(session).toBe(firstConversation);
		}

		const newConversation = `conv-b-${Date.now()}-new`;

		const third = await createUiStream(userMessage('new conversation'), {
			provider: 'openai-compatible',
			model: 'mock-model',
			tools: { getTime: getTimeTool() },
			aiSettings: responsesSettings(),
			conversationId: newConversation,
		});

		await third.text;

		const latest = captured[captured.length - 1]!;
		expect(latest.headers['x-opencode-session']).toBe(newConversation);
		expect(latest.headers['x-opencode-session']).not.toBe(firstConversation);
	}, 30_000);

	it('omits the session header when not configured', async () => {
		captured.length = 0;

		const stream = await createUiStream(userMessage('hello'), {
			provider: 'openai-compatible',
			model: 'mock-model',
			tools: {},
			aiSettings: { ...responsesSettings(), openaiCompatibleSessionHeader: null },
			conversationId: 'conv-omitted',
		});

		await stream.text;

		expect(captured.length).toBeGreaterThan(0);

		for (const req of captured) {
			expect(req.url).toBe('/v1/responses');
			expect(req.headers['x-opencode-session']).toBeUndefined();
		}
	}, 30_000);
});
