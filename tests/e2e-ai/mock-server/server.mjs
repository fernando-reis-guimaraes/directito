// Deterministic mock for OpenAI Responses + Chat Completions endpoints.
// Records inbound requests (secrets redacted) for Playwright assertions.
// No dependencies; run with: node mock-server/server.mjs [port]
import { createServer } from 'node:http';

const requests = [];
let counter = 0;

const sse = (events) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n';

const textResponsesEvents = (text) => [
	{ type: 'response.created', response: { id: `resp_${++counter}`, created_at: 1, model: 'e2e-model' } },
	{ type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'msg_1' } },
	{ type: 'response.output_text.delta', item_id: 'msg_1', delta: text },
	{ type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'msg_1' } },
	{ type: 'response.completed', response: { usage: { input_tokens: 5, output_tokens: 3 } } },
];

const chatCompletionsEvents = (text) => [
	{
		id: 'chatcmpl_e2e',
		object: 'chat.completion.chunk',
		created: 1,
		model: 'e2e-model',
		choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }],
	},
	{
		id: 'chatcmpl_e2e',
		object: 'chat.completion.chunk',
		created: 1,
		model: 'e2e-model',
		choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
	},
];

function redact(headers) {
	const out = { ...headers };
	if (out.authorization) out.authorization = '<present>';
	return out;
}

const server = createServer((req, res) => {
	if (req.method === 'GET' && req.url === '/__log') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(requests));
		return;
	}

	if (req.method === 'POST' && req.url === '/__reset') {
		requests.length = 0;
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end('{}');
		return;
	}

	let raw = '';
	req.on('data', (c) => (raw += c));

	req.on('end', () => {
		let body = null;

		try {
			body = raw ? JSON.parse(raw) : null;
		} catch {
			body = null;
		}

		if (req.url === '/v1/responses' && req.method === 'POST') {
			const inputText = JSON.stringify(body?.input ?? '');
			const turn = (requests.filter((r) => r.url === '/v1/responses').length % 3) + 1;
			const text = `E2E-OK turn-${turn} input-len-${inputText.length}`;
			requests.push({ method: req.method, url: req.url, headers: redact(req.headers), model: body?.model });
			res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
			res.end(sse(textResponsesEvents(text)));
			return;
		}

		if (req.url === '/v1/chat/completions' && req.method === 'POST') {
			requests.push({ method: req.method, url: req.url, headers: redact(req.headers), model: body?.model });
			res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
			res.end(sse(chatCompletionsEvents('E2E-CHAT-OK')));
			return;
		}

		res.writeHead(404, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'not found' }));
	});
});

const port = Number(process.argv[2] ?? 18055);

server.listen(port, '127.0.0.1', () => {
	// eslint-disable-next-line no-console -- startup banner for the local E2E mock server
	console.log(`mock AI server on http://127.0.0.1:${port}`);
});
