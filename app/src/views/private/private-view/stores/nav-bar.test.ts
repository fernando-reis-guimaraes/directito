import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';
import { nextTick, reactive, type Ref, ref } from 'vue';
import { moduleOfPath, useNavBarStore } from './nav-bar';

const storageRefs = new Map<string, Ref>();
const route = reactive({ fullPath: '/content' });
const lg = ref(true);
const xl = ref(true);

vi.mock('@vueuse/core', async () => {
	const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core');

	return {
		...actual,
		useLocalStorage: (key: string, defaultValue: unknown) => {
			const r = ref(defaultValue);
			storageRefs.set(key, r);
			return r;
		},
		useBreakpoints: () => ({ lg, xl }),
	};
});

vi.mock('vue-router', () => ({
	useRoute: () => route,
}));

beforeEach(() => {
	storageRefs.clear();
	setActivePinia(createPinia());
	route.fullPath = '/content';
	lg.value = true;
	xl.value = true;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('nav-bar store size guard', () => {
	it('returns default size on init', () => {
		const store = useNavBarStore();
		expect(store.size).toBe(225);
	});

	it('accepts finite values', () => {
		const store = useNavBarStore();
		store.size = 300;
		expect(store.size).toBe(300);
	});

	it('rejects NaN and returns default', () => {
		const store = useNavBarStore();
		store.size = NaN;
		expect(store.size).toBe(225);
	});

	it('rejects Infinity and returns default', () => {
		const store = useNavBarStore();
		store.size = Infinity;
		expect(store.size).toBe(225);
	});

	it('rejects -Infinity and returns default', () => {
		const store = useNavBarStore();
		store.size = -Infinity;
		expect(store.size).toBe(225);
	});

	it('preserves last valid value after rejected write', () => {
		const store = useNavBarStore();
		store.size = 320;
		store.size = NaN;
		expect(store.size).toBe(320);
	});

	it('self-heals corrupted stored value back to default', () => {
		const store = useNavBarStore();
		const storedSize = storageRefs.get('nav-bar-size')!;

		storedSize.value = NaN;
		expect(store.size).toBe(225);
		expect(storedSize.value).toBe(225);
	});
});

describe('moduleOfPath', () => {
	test('extracts the first path segment', () => {
		expect(moduleOfPath('/content')).toBe('content');
		expect(moduleOfPath('/content/articles')).toBe('content');
		expect(moduleOfPath('/users/123')).toBe('users');
		expect(moduleOfPath('/settings/project')).toBe('settings');
		expect(moduleOfPath('/embedded/my-site')).toBe('embedded');
	});

	test('ignores query strings and hashes', () => {
		expect(moduleOfPath('/content?page=2')).toBe('content');
		expect(moduleOfPath('/insights/1#section')).toBe('insights');
		expect(moduleOfPath('/files?sort=name#top')).toBe('files');
	});

	test('returns empty string for the root path', () => {
		expect(moduleOfPath('/')).toBe('');
	});
});

describe('nav-bar store module navigation', () => {
	test('reopens the nav when switching modules', async () => {
		const store = useNavBarStore();
		store.collapse();
		expect(store.collapsed).toBe(true);

		route.fullPath = '/users';
		await nextTick();

		expect(store.collapsed).toBe(false);
	});

	test('keeps a collapsed nav on same-module navigation', async () => {
		const store = useNavBarStore();
		store.collapse();

		route.fullPath = '/content/articles';
		await nextTick();

		expect(store.collapsed).toBe(true);
	});

	test('keeps a collapsed nav on query-only changes', async () => {
		const store = useNavBarStore();
		store.collapse();

		route.fullPath = '/content?page=2';
		await nextTick();

		expect(store.collapsed).toBe(true);
	});

	test('still collapses on route change when nav is not inline (mobile)', async () => {
		lg.value = false;
		xl.value = false;

		const store = useNavBarStore();
		store.expand();
		expect(store.collapsed).toBe(false);

		route.fullPath = '/users';
		await nextTick();

		expect(store.collapsed).toBe(true);
	});

	test('expandForModuleNavigation reopens only when inline', () => {
		const store = useNavBarStore();
		store.collapse();

		store.expandForModuleNavigation();
		expect(store.collapsed).toBe(false);

		store.collapse();

		lg.value = false;
		xl.value = false;
		store.expandForModuleNavigation();
		expect(store.collapsed).toBe(true);
	});
});
