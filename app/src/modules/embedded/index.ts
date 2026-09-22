import { defineModule } from '@directus/extensions';
import EmbeddedSiteView from './routes/embedded-site.vue';

export default defineModule({
	id: 'embedded',
	hidden: true,
	name: '$t:embedded_sites',
	icon: 'web_asset',
	routes: [
		{
			name: 'embedded-site',
			path: ':siteId?',
			component: EmbeddedSiteView,
			props: true,
		},
	],
});
