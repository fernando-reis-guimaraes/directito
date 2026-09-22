import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmbeddedSiteView from './embedded-site.vue';
import { Tooltip } from '@/__utils__/tooltip';
import type { GlobalMountOptions } from '@/__utils__/types';
import { i18n } from '@/lang';

const moduleBar = [
	{
		type: 'link',
		id: 'site-chat',
		name: 'Chat',
		icon: 'chat',
		url: 'https://chat.example.com/app',
		enabled: true,
		display: 'embedded',
		authentication: 'directus-api',
	},
	{
		type: 'link',
		id: 'site-public',
		name: 'Public',
		icon: 'public',
		url: 'https://public.example.com',
		enabled: true,
		display: 'embedded',
		authentication: 'none',
	},
	{
		type: 'link',
		id: 'site-broken',
		name: 'Broken',
		icon: 'error',
		url: 'javascript:alert(1)',
		enabled: true,
		display: 'embedded',
		authentication: 'identity',
	},
	{
		type: 'link',
		id: 'link-docs',
		name: 'Documentation',
		icon: 'menu_book',
		url: 'https://example.com/docs',
		enabled: true,
	},
];

let global: GlobalMountOptions;

beforeEach(() => {
	const pinia = createTestingPinia({
		createSpy: vi.fn,
		initialState: {
			settingsStore: { settings: { module_bar: moduleBar } },
		},
	});

	setActivePinia(pinia);

	global = {
		plugins: [i18n, pinia],
		directives: { tooltip: Tooltip },
		stubs: {
			PrivateView: {
				name: 'PrivateView',
				props: ['title', 'icon'],
				template: '<div class="private-view-stub"><slot name="actions" /><slot /></div>',
			},
			PrivateViewHeaderBarActionButton: {
				name: 'PrivateViewHeaderBarActionButton',
				template: '<button class="header-action-stub" />',
			},
			VNotice: {
				name: 'VNotice',
				template: '<div class="v-notice-stub"><slot /></div>',
			},
		},
	};
});

describe('EmbeddedSiteView', () => {
	it('retains the Directito shell with the site title', () => {
		const wrapper = mount(EmbeddedSiteView, {
			global,
			props: { siteId: 'site-chat' },
		});

		const shell = wrapper.findComponent({ name: 'PrivateView' });

		expect(shell.exists()).toBe(true);
		expect(shell.props('title')).toBe('Chat');
	});

	it('loads the configured iframe URL without credentials', () => {
		const wrapper = mount(EmbeddedSiteView, {
			global,
			props: { siteId: 'site-chat' },
		});

		const iframe = wrapper.find('iframe');

		expect(iframe.exists()).toBe(true);
		expect(iframe.attributes('src')).toBe('https://chat.example.com/app');
		expect(iframe.attributes('src')).not.toContain('access_token');
		expect(iframe.attributes('src')).not.toContain('Bearer');
		expect(iframe.attributes('src')).not.toContain('?code=');
	});

	it('sets sensible iframe sandbox, allow, and referrerpolicy attributes', () => {
		const wrapper = mount(EmbeddedSiteView, {
			global,
			props: { siteId: 'site-chat' },
		});

		const iframe = wrapper.find('iframe');

		expect(iframe.attributes('sandbox')).toContain('allow-scripts');
		expect(iframe.attributes('allow')).toBeTruthy();
		expect(iframe.attributes('referrerpolicy')).toBe('strict-origin-when-cross-origin');
	});

	it('renders public sites without a session bridge notice', () => {
		const wrapper = mount(EmbeddedSiteView, {
			global,
			props: { siteId: 'site-public' },
		});

		expect(wrapper.find('iframe').attributes('src')).toBe('https://public.example.com');
	});

	it('shows an explanation instead of framing dangerous URLs', () => {
		const wrapper = mount(EmbeddedSiteView, {
			global,
			props: { siteId: 'site-broken' },
		});

		expect(wrapper.find('iframe').exists()).toBe(false);
		expect(wrapper.find('.v-notice-stub').exists()).toBe(true);
	});

	it('shows a not-found state for unknown or external entries', () => {
		for (const siteId of ['site-missing', 'link-docs', undefined]) {
			const wrapper = mount(EmbeddedSiteView, {
				global,
				props: { siteId },
			});

			expect(wrapper.find('iframe').exists()).toBe(false);
			expect(wrapper.find('.v-notice-stub').exists()).toBe(true);
		}
	});
});
