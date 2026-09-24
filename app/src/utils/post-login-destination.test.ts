import { describe, expect, test } from 'vitest';
import { resolvePostLoginDestination } from './post-login-destination';

describe('resolvePostLoginDestination', () => {
	test('unset homepage preserves legacy behavior (redirect -> last_page -> /content)', () => {
		expect(resolvePostLoginDestination(undefined, null, null)).toBe('/content');
		expect(resolvePostLoginDestination(undefined, undefined, '/content/articles')).toBe('/content/articles');
		expect(resolvePostLoginDestination('/settings/users', null, '/content/articles')).toBe('/settings/users');
	});

	test('homepage wins over last_page', () => {
		expect(resolvePostLoginDestination(undefined, '/embedded/home', '/content/articles')).toBe('/embedded/home');
	});

	test('explicit redirect wins over homepage', () => {
		expect(resolvePostLoginDestination('/content/orders', '/embedded/home', '/content/articles')).toBe(
			'/content/orders',
		);
	});

	test('empty homepage behaves as disabled', () => {
		expect(resolvePostLoginDestination(undefined, '', '/content/articles')).toBe('/content/articles');
		expect(resolvePostLoginDestination(undefined, '   ', null)).toBe('/content');
	});

	test('invalid homepage value falls back to last_page', () => {
		expect(resolvePostLoginDestination(undefined, 'https://example.com', '/content/articles')).toBe(
			'/content/articles',
		);
		expect(resolvePostLoginDestination(undefined, '//example.com', null)).toBe('/content');
	});

	test('supports a custom fallback', () => {
		expect(resolvePostLoginDestination(undefined, null, null, '/login')).toBe('/login');
		expect(resolvePostLoginDestination(undefined, '/embedded/home', null, '/login')).toBe('/embedded/home');
	});

	test('does not act as a permanent guard (pure function of its inputs)', () => {
		// Same inputs always produce the same output; normal in-app navigation
		// never consults this helper, so refreshing another page cannot redirect back.
		expect(resolvePostLoginDestination(undefined, '/embedded/home', '/other/page')).toBe('/embedded/home');
		expect(resolvePostLoginDestination(undefined, null, '/other/page')).toBe('/other/page');
	});
});
