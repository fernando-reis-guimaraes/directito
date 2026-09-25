import { createEventHook, useBreakpoints, useLocalStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { BREAKPOINTS } from '@/constants';
import { useSidebarStore } from '@/views/private/private-view/stores/sidebar';

/**
 * First path segment identifies the module (`/content/articles` → `content`).
 * Query strings and hashes are ignored.
 */
export function moduleOfPath(fullPath: string): string {
	const withoutQuery = fullPath.split('?')[0] ?? '';
	const withoutHash = withoutQuery.split('#')[0] ?? '';
	return withoutHash.split('/').filter(Boolean)[0] ?? '';
}

export const useNavBarStore = defineStore('nav-bar-store', () => {
	const collapsed = useLocalStorage('nav-bar-collapsed', false);

	const DEFAULT_SIZE = 225;
	const storedSize = useLocalStorage('nav-bar-size', DEFAULT_SIZE);

	const size = computed({
		get() {
			const val = storedSize.value;

			if (!Number.isFinite(val)) {
				storedSize.value = DEFAULT_SIZE;
				return DEFAULT_SIZE;
			}

			return val;
		},
		set(val: number) {
			if (Number.isFinite(val)) storedSize.value = val;
		},
	});

	const route = useRoute();
	const { lg, xl } = useBreakpoints(BREAKPOINTS);
	const sidebarStore = useSidebarStore();

	const inlineNav = computed(() => {
		return sidebarStore.collapsed ? lg.value : xl.value;
	});

	const previousModule = ref(moduleOfPath(route.fullPath));

	watch(
		() => route.fullPath,
		(fullPath) => {
			if (!inlineNav.value) {
				previousModule.value = moduleOfPath(fullPath);
				collapse();
				return;
			}

			const mod = moduleOfPath(fullPath);

			// Switching modules (Content, Users, Files, Insights, Settings, …)
			// always reopens the left navigation: a collapsed nav looks like a
			// broken or empty page to non-technical users.
			if (mod !== previousModule.value) {
				previousModule.value = mod;
				expand();
			}
		},
	);

	const collapseHook = createEventHook();
	const expandHook = createEventHook();

	const collapse = () => {
		if (collapsed.value === true) return;
		collapsed.value = true;
		collapseHook.trigger();
	};

	const expand = () => {
		if (collapsed.value === false) return;
		collapsed.value = false;
		expandHook.trigger();
	};

	const toggle = () => {
		if (collapsed.value === true) expand();
		else collapse();
	};

	/**
	 * Reopen the left navigation when the user picks a module in the module
	 * bar — including re-clicking the current module, which performs no route
	 * change and therefore never reaches the watcher above.
	 */
	const expandForModuleNavigation = () => {
		if (inlineNav.value) expand();
	};

	return {
		collapsed,
		size,
		collapse,
		expand,
		toggle,
		expandForModuleNavigation,
		onCollapse: collapseHook.on,
		onExpand: expandHook.on,
	};
});
