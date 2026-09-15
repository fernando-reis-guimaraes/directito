import { expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { defaultValues, useFormFields, validate } from './form';

vi.mock('@/stores/relations', () => ({
	useRelationsStore: () => ({
		getRelationsForField: () => [],
	}),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: () => '',
	}),
	createI18n: () => undefined,
}));

test('useFormFields for setup', () => {
	const result = useFormFields(true, ref(defaultValues));

	expect(result.value.map((field) => field.field)).toEqual([
		'first_name',
		'last_name',
		'email',
		'password',
		'password_confirm',
	]);
});

test('useFormFields for modal/edit', () => {
	const result = useFormFields(false, ref(defaultValues));

	expect(result.value.map((field) => field.field)).toEqual(['project_owner']);
});

test('validate on invalid setup form', () => {
	const fields = useFormFields(true, ref(defaultValues));
	const result = validate({}, fields, true);

	expect(result.length).toBeGreaterThan(0);
	expect(result.map((error) => error.field)).toContain('email');
});

test('validate on valid setup form', () => {
	const fields = useFormFields(true, ref(defaultValues));

	const result = validate(
		{
			first_name: 'Admin',
			last_name: 'User',
			email: 'admin@example.com',
			password: 'pw',
			password_confirm: 'pw',
			project_usage: null,
			license: true,
			product_updates: false,
		},
		fields,
		true,
	);

	expect(result).toEqual([]);
});

test('validate on setup form without owner information', () => {
	const fields = useFormFields(true, ref(defaultValues));

	// Absent owner information is a valid normal state and must not block setup.
	const result = validate(
		{
			first_name: 'Admin',
			last_name: 'User',
			email: 'admin@example.com',
			password: 'pw',
			password_confirm: 'pw',
			project_usage: null,
			project_owner: null,
			org_name: null,
			license: false,
			product_updates: false,
		},
		fields,
		true,
	);

	expect(result).toEqual([]);
});

test('validate owner metadata as optional when editing', () => {
	const fields = useFormFields(false, ref(defaultValues));

	// Empty owner metadata must validate cleanly outside of setup as well.
	expect(validate({}, fields)).toEqual([]);
	expect(validate({ project_owner: null }, fields)).toEqual([]);
});

test('validate with unequal password', () => {
	const fields = useFormFields(true, ref(defaultValues));

	const result = validate(
		{
			first_name: 'Admin',
			last_name: 'User',
			email: 'admin@example.com',
			password: 'pw',
			password_confirm: 'invalid',
			project_usage: null,
			license: false,
			product_updates: false,
		},
		fields,
		true,
	);

	expect(result).toMatchObject([
		{
			field: 'password_confirm',
			type: 'confirm_password',
		},
	]);
});
