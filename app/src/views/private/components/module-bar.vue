<script setup lang="ts">
import { omit } from 'lodash';
import { computed } from 'vue';
import ModuleBarAvatar from './module-bar-avatar.vue';
import ModuleBarLogo from './module-bar-logo.vue';
import VButton from '@/components/v-button.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import { MODULE_BAR_DEFAULT } from '@/constants';
import { useExtensions } from '@/extensions';
import { useSettingsStore } from '@/stores/settings';
import { translate } from '@/utils/translate-object-values';
import { useNavBarStore } from '@/views/private/private-view/stores/nav-bar';
import { useSidebarStore } from '@/views/private/private-view/stores/sidebar';

const settingsStore = useSettingsStore();
const navBarStore = useNavBarStore();
const sidebarStore = useSidebarStore();
const { modules: registeredModules } = useExtensions();

const registeredModuleIDs = computed(() => registeredModules.value.map((module) => module.id));

const modules = computed(() => {
	if (!settingsStore.settings) return [];

	return (settingsStore.settings.module_bar ?? MODULE_BAR_DEFAULT)
		.filter((modulePart) => {
			if (modulePart.type === 'link') return true;
			return modulePart.enabled && registeredModuleIDs.value.includes(modulePart.id);
		})
		.map((modulePart) => {
			if (modulePart.type === 'link') {
				const link = omit<Record<string, any>>(modulePart, ['url']);

				if (modulePart.display === 'embedded') {
					// Embedded sites navigate inside the SPA so the Directito shell
					// (Module Bar, header, back/forward) is retained.
					link.to = `/embedded/${modulePart.id}`;
				} else if (modulePart.url.startsWith('/')) {
					link.to = modulePart.url;
				} else {
					link.href = modulePart.url;
				}

				return translate(link);
			}

			const module = registeredModules.value.find((module) => module.id === modulePart.id)!;

			return {
				...modulePart,
				...registeredModules.value.find((module) => module.id === modulePart.id),
				to: `/${module.id}`,
			};
		});
});

function isEmbeddedEntry(modulePart: Record<string, any>): boolean {
	return (
		modulePart?.['display'] === 'embedded' ||
		(typeof modulePart?.['to'] === 'string' && (modulePart['to'] as string).startsWith('/embedded/'))
	);
}

function onModuleClick(modulePart: Record<string, any>, event: MouseEvent) {
	// New-tab opens (ctrl/cmd+click, middle button) keep the current shell state.
	if (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) return;

	// Embedded sites open in an iframe inside Directito: close both sidebars
	// (left nav + right sidebar) to give the frame maximum width. Closing here
	// gives instant feedback; the embedded route itself also collapses and
	// restores the previous state on leave.
	if (isEmbeddedEntry(modulePart)) {
		navBarStore.collapse();
		sidebarStore.collapse();
		return;
	}

	navBarStore.expandForModuleNavigation();
}
</script>

<template>
	<div class="module-bar">
		<ModuleBarLogo />

		<div class="modules">
			<VButton
				v-for="modulePart in modules"
				:key="modulePart.id"
				v-tooltip.right="modulePart.name"
				icon
				x-large
				:to="modulePart.to"
				:href="modulePart.href"
				tile
				@click="(event) => onModuleClick(modulePart, event)"
			>
				<VIcon :name="modulePart.icon" />
			</VButton>
		</div>

		<ModuleBarAvatar />
	</div>
</template>

<style lang="scss" scoped>
.module-bar {
	--focus-ring-color: var(--theme--navigation--modules--button--foreground);
	--focus-ring-offset: var(--focus-ring-offset-inset);
	--focus-ring-radius: 0;

	display: flex;
	flex-direction: column;
	inline-size: 3.375rem;
	block-size: 100%;
	background-color: var(--theme--navigation--modules--background);
	border-inline-end: var(--theme--navigation--modules--border-width) solid
		var(--theme--navigation--modules--border-color);

	/* Explicitly render the border outside of the width of the bar itself */
	box-sizing: content-box;

	.modules {
		flex-grow: 1;
		overflow: hidden auto;
	}

	.v-button {
		--v-button-color: var(--theme--navigation--modules--button--foreground);
		--v-button-color-hover: var(--theme--navigation--modules--button--foreground-hover);
		--v-button-color-active: var(--theme--navigation--modules--button--foreground-active);
		--v-button-background-color: var(--theme--navigation--modules--button--background);
		--v-button-background-color-hover: var(--theme--navigation--modules--button--background-hover);
		--v-button-background-color-active: var(--theme--navigation--modules--button--background-active);

		:deep(.active) {
			--focus-ring-color: var(--v-button-color-active);
		}
	}
}

.module-bar-logo {
	--focus-ring-color: var(--foreground-inverted);
}
</style>
