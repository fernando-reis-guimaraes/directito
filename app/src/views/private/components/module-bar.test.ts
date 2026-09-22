import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import ModuleBar from './module-bar.vue';
import { generateRouter } from '@/__utils__/router';
import { Tooltip } from '@/__utils__/tooltip';
import type { GlobalMountOptions } from '@/__utils__/types';
import VButton from '@/components/v-button.vue';
import { i18n } from '@/lang';

const moduleBar = [
	{ type: 'module', id: 'content', enabled: true },
	{
		type: 'link',
		id: 'link-docs',
		name: 'Documentation',
		icon: 'menu_book',
		url: 'https://example.com/docs',
		enabled: true,
	},
	{
		type: 'link',
		id: 'link-internal',
		name: 'Internal',
		icon: 'link',
		url: '/insights/1',
		enabled: true,
	},
	{
		type: 'link',
		id: 'site-grafana',
		name: 'Grafana',
		icon: 'monitoring',
		url: 'https://grafana.example.com',
		enabled: true,
		display: 'embedded',
		authentication: 'identity',
	},
	{
		type: 'link',
		id: 'site-chat',
		name: 'Chat',
		icon: 'chat',
		url: 'https://chat.example.com',
		enabled: true,
		display: 'embedded',
		authentication: 'directus-api',
	},
];

let router: Router;
let global: GlobalMountOptions;

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
			ModuleBarLogo: true,
			ModuleBarAvatar: true,
			VIcon: true,
		},
	};
});

describe('ModuleBar custom links', () => {
	it('keeps legacy external links as external hrefs', () => {
		const wrapper = mount(ModuleBar, { global });

		const buttons = wrapper.findAllComponents(VButton);
		const docs = buttons.find((button) => button.props('href') === 'https://example.com/docs');

		expect(docs).toBeDefined();
		expect(docs!.props('to')).toBeFalsy();
	});

	it('keeps legacy internal links as internal routes', () => {
		const wrapper = mount(ModuleBar, { global });

		const buttons = wrapper.findAllComponents(VButton);
		const internal = buttons.find((button) => button.props('to') === '/insights/1');

		expect(internal).toBeDefined();
		expect(internal!.props('href')).toBeFalsy();
	});

	it('renders one independent internal icon per embedded site', () => {
		const wrapper = mount(ModuleBar, { global });

		const buttons = wrapper.findAllComponents(VButton);

		const grafana = buttons.find((button) => button.props('to') === '/embedded/site-grafana');
		const chat = buttons.find((button) => button.props('to') === '/embedded/site-chat');

		expect(grafana).toBeDefined();
		expect(chat).toBeDefined();

		// Embedded entries navigate inside the SPA, never to a raw href
		expect(grafana!.props('href')).toBeFalsy();
		expect(chat!.props('href')).toBeFalsy();
	});

	it('renders N independent icons for N embedded configurations', () => {
		const wrapper = mount(ModuleBar, { global });

		const embedded = wrapper.findAllComponents(VButton).filter((button) => {
			const to = button.props('to') as unknown;
			return typeof to === 'string' && to.startsWith('/embedded/');
		});

		expect(embedded).toHaveLength(2);
	});
});
