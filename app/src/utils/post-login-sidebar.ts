import type { Settings } from '@directus/types';
import { useNavBarStore } from '@/views/private/private-view/stores/nav-bar';
import { useSidebarStore } from '@/views/private/private-view/stores/sidebar';

type PostLoginSidebarSettings = Pick<Settings, 'homepage_navbar_open' | 'homepage_sidebar_open'>;

/**
 * Applies the administrator-configured post-login sidebar state.
 *
 * This is a POST-LOGIN default only, not a navigation guard: once applied,
 * the user navigates freely and can expand/collapse both panels.
 *
 * - `true` expands the panel, `false` collapses it.
 * - `null`/`undefined` (unknown or legacy settings row) preserves the user's
 *   stored preference (`localStorage`) instead of forcing a state.
 */
export function applyPostLoginSidebarState(settings?: PostLoginSidebarSettings | null): void {
	if (!settings) return;

	const sidebarStore = useSidebarStore();
	const navBarStore = useNavBarStore();

	// Apply the right sidebar first: on medium breakpoints the nav-bar store
	// reacts to the sidebar state, so the explicit nav-bar value must win last.
	if (typeof settings.homepage_sidebar_open === 'boolean') {
		if (settings.homepage_sidebar_open) sidebarStore.expand();
		else sidebarStore.collapse();
	}

	if (typeof settings.homepage_navbar_open === 'boolean') {
		if (settings.homepage_navbar_open) navBarStore.expand();
		else navBarStore.collapse();
	}
}
