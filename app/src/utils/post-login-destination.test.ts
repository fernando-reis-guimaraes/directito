import { describe, expect, test } from 'vitest';
import { normalizeHomepagePath, resolvePostLoginDestination } from './post-login-destination';

describe('normalizeHomepagePath', () => {
	test('null/undefined/empty behaves as disabled', () => {
		expect(normalizeHomepagePath(null)).toBeNull();
		expect(normalizeHomepagePath(undefined)).toBeNull();
		expect(normalizeHomepagePath('')).toBeNull();
		expect(normalizeHomepagePath('   ')).toBeNull();
	});

	test('accepts arbitrary internal paths', () => {
		expect(normalizeHomepagePath('/content')).toBe('/content');
		expect(normalizeHomepagePath('/content/turmas/123')).toBe('/content/turmas/123');
		expect(normalizeHomepagePath('/content/foo?tab=bar')).toBe('/content/foo?tab=bar');
		expect(normalizeHomepagePath('/content/foo#section')).toBe('/content/foo#section');
		expect(normalizeHomepagePath('/settings/project')).toBe('/settings/project');
		expect(normalizeHomepagePath('/users')).toBe('/users');
	});

	test('accepts embedded routes', () => {
		expect(normalizeHomepagePath('/embedded/site-id')).toBe('/embedded/site-id');
		expect(normalizeHomepagePath('/embedded/my-site')).toBe('/embedded/my-site');
	});

	test('trims surrounding whitespace', () => {
		expect(normalizeHomepagePath('  /content  ')).toBe('/content');
	});

	test('rejects absolute URLs', () => {
		expect(normalizeHomepagePath('https://example.com')).toBeNull();
		expect(normalizeHomepagePath('http://example.com')).toBeNull();
		expect(normalizeHomepagePath('https://example.com/content')).toBeNull();
	});

	test('rejects protocol-relative URLs', () => {
		expect(normalizeHomepagePath('//example.com')).toBeNull();
		expect(normalizeHomepagePath('//example.com/content')).toBeNull();
	});

	test('rejects dangerous schemes', () => {
		expect(normalizeHomepagePath('javascript:alert(1)')).toBeNull();
		expect(normalizeHomepagePath('data:text/html,<h1>hi</h1>')).toBeNull();
		expect(normalizeHomepagePath('/javascript:alert(1)')).toBeNull();
		expect(normalizeHomepagePath('/data:text/html,hi')).toBeNull();
	});

	test('rejects backslash-based attempts', () => {
		expect(normalizeHomepagePath('/\\example.com')).toBeNull();
		expect(normalizeHomepagePath('/content\\foo')).toBeNull();
		expect(normalizeHomepagePath('\\example.com')).toBeNull();
	});

	test('rejects paths not starting with /', () => {
		expect(normalizeHomepagePath('content')).toBeNull();
		expect(normalizeHomepagePath('embedded/site-id')).toBeNull();
	});
});

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
