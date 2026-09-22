import type { SettingsModuleBarLink } from '@directus/types';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import {
	EMBEDDED_READY_MESSAGE,
	EMBEDDED_REFRESH_MESSAGE,
	EMBEDDED_SESSION_MESSAGE,
	originOf,
	useEmbeddedBridge,
} from './use-embedded-bridge';
import sdk from '@/sdk';

vi.mock('@/sdk', async () => {
	const { mockSdk } = await import('@/test-utils/sdk');
	return mockSdk();
});

const chatSite = {
	type: 'link',
	id: 'site-chat',
	name: 'Chat',
	icon: 'chat',
	url: 'https://chat.example.com/app',
	enabled: true,
	display: 'embedded',
	authentication: 'directus-api',
} as SettingsModuleBarLink;

let wrappers: VueWrapper<any>[] = [];

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(sdk.request).mockResolvedValue({ code: 'one-time-code', expires_in: 30000 });
});

afterEach(() => {
	for (const wrapper of wrappers) wrapper.unmount();
	wrappers = [];
	vi.clearAllMocks();
});

function mountBridge(site: SettingsModuleBarLink | null = chatSite) {
	const postMessage = vi.fn();

	let harness!: {
		bridgeEnabled: { value: boolean };
		frame: HTMLIFrameElement;
	};

	const TestComponent = defineComponent({
		setup() {
			const siteRef = ref(site);

			const frameEl = ref({
				contentWindow: { postMessage },
			} as unknown as HTMLIFrameElement);

			const bridge = useEmbeddedBridge(siteRef, frameEl);

			harness = { bridgeEnabled: bridge.bridgeEnabled, frame: frameEl.value! };

			return () => h('div');
		},
	});

	const wrapper = mount(TestComponent);
	wrappers.push(wrapper);

	return { postMessage, source: harness!.frame.contentWindow, bridgeEnabled: harness!.bridgeEnabled };
}

function dispatchHandshake(source: unknown, origin: string, type: string): void {
	const event = new MessageEvent('message', { data: { type } });

	Object.defineProperty(event, 'source', { value: source });
	Object.defineProperty(event, 'origin', { value: origin });

	window.dispatchEvent(event);
}

describe('originOf', () => {
	it('returns the origin of absolute http(s) URLs', () => {
		expect(originOf('https://chat.example.com/app?x=1')).toBe('https://chat.example.com');
		expect(originOf('http://internal.local:3000/app')).toBe('http://internal.local:3000');
	});

	it('returns null for malformed URLs', () => {
		expect(originOf('not a url')).toBe(null);
	});
});

describe('useEmbeddedBridge', () => {
	it('is disabled for authentication none', () => {
		const { bridgeEnabled } = mountBridge({ ...chatSite, authentication: 'none' });
		expect(bridgeEnabled.value).toBe(false);
	});

	it('is disabled for external display', () => {
		const { bridgeEnabled } = mountBridge({ ...chatSite, display: 'external' });
		expect(bridgeEnabled.value).toBe(false);
	});

	it('is disabled for legacy links without new properties', () => {
		const { bridgeEnabled } = mountBridge({
			type: 'link',
			id: 'site-docs',
			name: 'Docs',
			icon: 'menu_book',
			url: 'https://example.com',
			enabled: true,
		} as SettingsModuleBarLink);

		expect(bridgeEnabled.value).toBe(false);
	});

	it('is enabled for embedded identity and directus-api links', () => {
		expect(mountBridge({ ...chatSite, authentication: 'identity' }).bridgeEnabled.value).toBe(true);
		expect(mountBridge({ ...chatSite, authentication: 'directus-api' }).bridgeEnabled.value).toBe(true);
	});

	it('delivers a session code to the exact site origin on ready', async () => {
		const { source, postMessage } = mountBridge();

		dispatchHandshake(source, 'https://chat.example.com', EMBEDDED_READY_MESSAGE);

		await vi.waitFor(() => expect(sdk.request).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

		const [message, targetOrigin] = postMessage.mock.calls[0]!;
		expect(message).toEqual({ type: EMBEDDED_SESSION_MESSAGE, code: 'one-time-code' });
		expect(targetOrigin).toBe('https://chat.example.com');
	});

	it('never uses a wildcard target origin', async () => {
		const { source, postMessage } = mountBridge();

		dispatchHandshake(source, 'https://chat.example.com', EMBEDDED_READY_MESSAGE);

		await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());

		for (const [, targetOrigin] of postMessage.mock.calls) {
			expect(targetOrigin).not.toBe('*');
		}
	});

	it('ignores handshake messages from other origins', async () => {
		const { source, postMessage } = mountBridge();

		dispatchHandshake(source, 'https://evil.example.com', EMBEDDED_READY_MESSAGE);

		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(sdk.request).not.toHaveBeenCalled();
		expect(postMessage).not.toHaveBeenCalled();
	});

	it('ignores messages that did not come from the embedded frame', async () => {
		mountBridge();

		dispatchHandshake({}, 'https://chat.example.com', EMBEDDED_READY_MESSAGE);

		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(sdk.request).not.toHaveBeenCalled();
	});

	it('ignores unknown message types', async () => {
		const { source, postMessage } = mountBridge();

		dispatchHandshake(source, 'https://chat.example.com', 'some:other-message');

		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(sdk.request).not.toHaveBeenCalled();
		expect(postMessage).not.toHaveBeenCalled();
	});

	it('re-issues a code on refresh while the session remains valid', async () => {
		const { source, postMessage } = mountBridge();

		dispatchHandshake(source, 'https://chat.example.com', EMBEDDED_READY_MESSAGE);

		await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

		vi.mocked(sdk.request).mockResolvedValue({ code: 'second-code', expires_in: 30000 });

		dispatchHandshake(source, 'https://chat.example.com', EMBEDDED_REFRESH_MESSAGE);

		await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));

		expect(postMessage.mock.calls[1]![0]).toEqual({ type: EMBEDDED_SESSION_MESSAGE, code: 'second-code' });
	});

	it('sends nothing for authentication none entries', async () => {
		const { source, postMessage } = mountBridge({ ...chatSite, authentication: 'none' });

		dispatchHandshake(source, 'https://chat.example.com', EMBEDDED_READY_MESSAGE);

		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(sdk.request).not.toHaveBeenCalled();
		expect(postMessage).not.toHaveBeenCalled();
	});
});
