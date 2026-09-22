<script setup lang="ts">
import type { SettingsModuleBarLink } from '@directus/types';
import { computed, ref } from 'vue';
import { useEmbeddedBridge } from '../composables/use-embedded-bridge';
import VNotice from '@/components/v-notice.vue';
import { useSettingsStore } from '@/stores/settings';
import { translate } from '@/utils/translate-object-values';
import { PrivateView, PrivateViewHeaderBarActionButton } from '@/views/private';

const props = withDefaults(
	defineProps<{
		siteId?: string | null;
	}>(),
	{ siteId: null },
);

const settingsStore = useSettingsStore();
const frameEl = ref<HTMLIFrameElement | null>(null);

const site = computed<SettingsModuleBarLink | null>(() => {
	if (!props.siteId || !settingsStore.settings?.module_bar) return null;

	const entry = settingsStore.settings.module_bar.find((part) => part.type === 'link' && part.id === props.siteId);

	if (!entry || entry.type !== 'link') return null;
	if ((entry.display ?? 'external') !== 'embedded') return null;

	return entry;
});

const siteName = computed(() => (site.value ? translate(site.value.name) : null));

const urlError = computed<string | null>(() => {
	if (!site.value) return null;

	try {
		const parsed = new URL(site.value.url);

		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return 'embedded_site_invalid_protocol';
		}

		return null;
	} catch {
		return 'embedded_site_invalid_url';
	}
});

// Registers the parent side of the session handshake. No-op for `authentication === 'none'`.
useEmbeddedBridge(site, frameEl);

function reload() {
	// Reloading the src attribute is enough; bearer tokens are never part of the URL.
	if (frameEl.value && site.value) frameEl.value.src = site.value.url;
}

function openExternally() {
	if (site.value) window.open(site.value.url, '_blank', 'noopener,noreferrer');
}
</script>

<template>
	<PrivateView :title="siteName ?? $t('embedded_sites')" icon="web_asset">
		<template #actions>
			<PrivateViewHeaderBarActionButton
				v-if="site && !urlError"
				v-tooltip.bottom="$t('reload_page')"
				icon="refresh"
				@click="reload"
			/>
			<PrivateViewHeaderBarActionButton
				v-if="site && !urlError"
				v-tooltip.bottom="$t('open_externally')"
				icon="open_in_new"
				@click="openExternally"
			/>
		</template>

		<div v-if="!site" class="embedded-state">
			<VNotice type="warning">
				{{ $t('embedded_site_not_found') }}
			</VNotice>
		</div>

		<div v-else-if="urlError" class="embedded-state">
			<VNotice type="danger">
				{{ $t(urlError) }}
			</VNotice>
		</div>

		<div v-else class="embedded-frame-container">
			<iframe
				:key="site.id"
				ref="frameEl"
				class="embedded-frame"
				:src="site.url"
				:title="siteName ?? site.id"
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
				allow="clipboard-read; clipboard-write; fullscreen; geolocation; microphone; camera; autoplay"
				referrerpolicy="strict-origin-when-cross-origin"
			/>
		</div>
	</PrivateView>
</template>

<style lang="scss" scoped>
.embedded-frame-container {
	display: flex;
	flex-direction: column;
	block-size: 100%;
	min-block-size: 0;
}

.embedded-frame {
	flex-grow: 1;
	inline-size: 100%;
	block-size: 100%;
	min-block-size: 0;
	border: none;
	background-color: var(--theme--background);
}

.embedded-state {
	padding: var(--content-padding);
}
</style>
