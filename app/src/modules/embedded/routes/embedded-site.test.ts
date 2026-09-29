import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import EmbeddedSiteView from './embedded-site.vue';
import { generateRouter } from '@/__utils__/router';
import { Tooltip } from '@/__utils__/tooltip';
import type { GlobalMountOptions } from '@/__utils__/types';
import { i18n } from '@/lang';
import { useNavBarStore } from '@/views/private/private-view/stores/nav-bar';
import { useSidebarStore } from '@/views/private/private-view/stores/sidebar';

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
let router: Router;

beforeEach(() => {
	const pinia = createTestingPinia({
		createSpy: vi.fn,
		initialState: {
			settingsStore: { settings: { module_bar: moduleBar } },
		},
	});

	setActivePinia(pinia);

	router = generateRouter([{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]);

	global = {
		plugins: [i18n, router, pinia],
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
		const sandbox = iframe.attributes('sandbox') ?? '';
		const tokens = sandbox.split(/\s+/).filter(Boolean);

		expect(iframe.attributes('sandbox')).toBeTruthy();
		expect(tokens).toContain('allow-scripts');
		expect(tokens).toContain('allow-same-origin');
		expect(tokens).toContain('allow-forms');
		expect(tokens).toContain('allow-popups');
		expect(tokens).toContain('allow-downloads');
		expect(tokens).toContain('allow-popups-to-escape-sandbox');
		expect(tokens).not.toContain('allow-top-navigation');
		expect(tokens).not.toContain('allow-top-navigation-by-user-activation');
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

describe('EmbeddedSiteView sidebars', () => {
	it('collapses both sidebars on entry to give the iframe maximum width', () => {
		mount(EmbeddedSiteView, {
			global,
			props: { siteId: 'site-chat' },
		});

		expect(useNavBarStore().collapse).toHaveBeenCalled();
		expect(useSidebarStore().collapse).toHaveBeenCalled();
	});

	it('restores previously open sidebars on leave (temporary close)', () => {
		const wrapper = mount(EmbeddedSiteView, {
			global,
			props: { siteId: 'site-chat' },
		});

		wrapper.unmount();

		expect(useNavBarStore().expand).toHaveBeenCalled();
		expect(useSidebarStore().expand).toHaveBeenCalled();
	});

	it('keeps both sidebars collapsed when switching between embedded sites', async () => {
		const wrapper = mount(EmbeddedSiteView, {
			global,
			props: { siteId: 'site-chat' },
		});

		const navBarStore = useNavBarStore();
		const sidebarStore = useSidebarStore();

		vi.clearAllMocks();

		await wrapper.setProps({ siteId: 'site-public' });

		expect(navBarStore.collapse).toHaveBeenCalled();
		expect(sidebarStore.collapse).toHaveBeenCalled();
	});
});
