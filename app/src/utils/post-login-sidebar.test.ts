import { beforeEach, describe, expect, test, vi } from 'vitest';
import { applyPostLoginSidebarState } from './post-login-sidebar';

const navBarStore = {
	expand: vi.fn(),
	collapse: vi.fn(),
};

const sidebarStore = {
	expand: vi.fn(),
	collapse: vi.fn(),
};

vi.mock('@/views/private/private-view/stores/nav-bar', () => ({
	useNavBarStore: () => navBarStore,
}));

vi.mock('@/views/private/private-view/stores/sidebar', () => ({
	useSidebarStore: () => sidebarStore,
}));

describe('applyPostLoginSidebarState', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('expands both panels when enabled', () => {
		applyPostLoginSidebarState({ homepage_navbar_open: true, homepage_sidebar_open: true });

		expect(navBarStore.expand).toHaveBeenCalledOnce();
		expect(navBarStore.collapse).not.toHaveBeenCalled();
		expect(sidebarStore.expand).toHaveBeenCalledOnce();
		expect(sidebarStore.collapse).not.toHaveBeenCalled();
	});

	test('collapses both panels when disabled', () => {
		applyPostLoginSidebarState({ homepage_navbar_open: false, homepage_sidebar_open: false });

		expect(navBarStore.collapse).toHaveBeenCalledOnce();
		expect(navBarStore.expand).not.toHaveBeenCalled();
		expect(sidebarStore.collapse).toHaveBeenCalledOnce();
		expect(sidebarStore.expand).not.toHaveBeenCalled();
	});

	test('applies each panel independently', () => {
		applyPostLoginSidebarState({ homepage_navbar_open: true, homepage_sidebar_open: false });

		expect(navBarStore.expand).toHaveBeenCalledOnce();
		expect(sidebarStore.collapse).toHaveBeenCalledOnce();
	});

	test('preserves stored preference when settings are unknown', () => {
		applyPostLoginSidebarState(null);
		applyPostLoginSidebarState(undefined);
		applyPostLoginSidebarState({ homepage_navbar_open: null, homepage_sidebar_open: undefined } as any);

		expect(navBarStore.expand).not.toHaveBeenCalled();
		expect(navBarStore.collapse).not.toHaveBeenCalled();
		expect(sidebarStore.expand).not.toHaveBeenCalled();
		expect(sidebarStore.collapse).not.toHaveBeenCalled();
	});
});
