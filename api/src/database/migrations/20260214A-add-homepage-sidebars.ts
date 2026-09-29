import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_settings', (table) => {
		table.boolean('homepage_navbar_open').notNullable().defaultTo(true);
		table.boolean('homepage_sidebar_open').notNullable().defaultTo(true);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_settings', (table) => {
		table.dropColumn('homepage_navbar_open');
		table.dropColumn('homepage_sidebar_open');
	});
}
