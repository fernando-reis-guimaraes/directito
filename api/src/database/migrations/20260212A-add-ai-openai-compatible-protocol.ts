import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_settings', (table) => {
		table.text('ai_openai_compatible_protocol');
		table.text('ai_openai_compatible_session_header');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_settings', (table) => {
		table.dropColumn('ai_openai_compatible_protocol');
		table.dropColumn('ai_openai_compatible_session_header');
	});
}
