import type { SettingsModuleBarLink } from '@directus/types';
import { computed, onBeforeUnmount, onMounted, type Ref } from 'vue';
import sdk, { requestEndpoint } from '@/sdk';

export const EMBEDDED_READY_MESSAGE = 'directito:embedded-ready';
export const EMBEDDED_SESSION_MESSAGE = 'directito:embedded-session';
export const EMBEDDED_REFRESH_MESSAGE = 'directito:embedded-refresh';

export function originOf(url: string): string | null {
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
}

/**
 * Generic parent side of the embedded-site session handshake.
 *
 * The iframe announces itself with `directito:embedded-ready` (or asks for a fresh
 * code later with `directito:embedded-refresh`). The parent — which owns the
 * authenticated Studio session — mints a short-lived one-time code via the API and
 * delivers it back with an exact `targetOrigin`. The iframe (or its backend) then
 * redeems the code directly against the API. Bearer tokens never travel through
 * URLs, query strings, or `postMessage`.
 */
export function useEmbeddedBridge(site: Ref<SettingsModuleBarLink | null>, frameEl: Ref<HTMLIFrameElement | null>) {
	const bridgeEnabled = computed(() => {
		const current = site.value;
		if (!current || current.type !== 'link') return false;
		return (current.display ?? 'external') === 'embedded' && (current.authentication ?? 'none') !== 'none';
	});

	async function issueSessionCode(): Promise<string | null> {
		const current = site.value;
		if (!current || !bridgeEnabled.value) return null;

		const response = await sdk.request<{ code: string; expires_in: number }>(
			requestEndpoint('/embedded-sites/session', {
				method: 'POST',
				body: { site_id: current.id },
			}),
		);

		return response?.code ?? null;
	}

	async function deliverSessionCode(): Promise<void> {
		const current = site.value;
		const frame = frameEl.value?.contentWindow;
		if (!current || !frame) return;

		const targetOrigin = originOf(current.url);
		if (!targetOrigin) return;

		const code = await issueSessionCode().catch(() => null);
		if (!code) return;

		frame.postMessage({ type: EMBEDDED_SESSION_MESSAGE, code }, targetOrigin);
	}

	function onMessage(event: MessageEvent): void {
		const current = site.value;
		if (!current || !bridgeEnabled.value) return;

		// Only accept handshake messages from the configured site origin and from
		// the embedded frame itself.
		if (event.origin !== originOf(current.url)) return;
		if (!frameEl.value?.contentWindow || event.source !== frameEl.value.contentWindow) return;

		const type = (event.data as { type?: unknown } | null)?.type;
		if (type !== EMBEDDED_READY_MESSAGE && type !== EMBEDDED_REFRESH_MESSAGE) return;

		void deliverSessionCode();
	}

	onMounted(() => {
		window.addEventListener('message', onMessage);
	});

	onBeforeUnmount(() => {
		window.removeEventListener('message', onMessage);
	});

	return { bridgeEnabled, deliverSessionCode };
}
