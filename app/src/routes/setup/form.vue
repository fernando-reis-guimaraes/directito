<script setup lang="ts">
import { SetupForm } from '@directus/types';
import { toRef } from 'vue';
import { defaultValues, useFormFields } from './form';
import VForm from '@/components/v-form/v-form.vue';

const props = withDefaults(
	defineProps<{
		register?: boolean;
		skipLicense?: boolean;
		modelValue?: Partial<SetupForm>;
		errors?: Record<string, any>[];
		initialValues?: SetupForm;
		utmLocation?: string;
	}>(),
	{
		register: true,
		skipLicense: false,
		utmLocation: '',
		initialValues: () => defaultValues,
		modelValue: () => ({}),
	},
);

const initialValues = toRef(props, 'initialValues');

const value = defineModel<SetupForm>();

const fields = useFormFields(props.register, value, initialValues);
</script>

<template>
	<div class="setup-form">
		<template v-if="register">
			<h1>{{ $t('setup_welcome') }}</h1>
			<p>{{ $t('setup_info') }}</p>
		</template>
		<VForm
			v-model="value"
			:initial-values="initialValues"
			:validation-errors="errors"
			:show-validation-errors="false"
			:fields="fields"
			disabled-menu
		></VForm>
	</div>
</template>

<style scoped>
.setup-form {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
}

.v-form {
	--theme--form--row-gap: 1.8125rem;
}

h1 {
	color: var(--theme--foreground-accent);
	font-size: 2.25rem;
	font-weight: 600;
	line-height: 1.1944;

	margin-block-end: 1.375rem;
}

p {
	font-size: 0.8125rem;
	font-weight: 500;
	line-height: 1.3846;
	margin-block-end: 1.8125rem;
}
</style>
