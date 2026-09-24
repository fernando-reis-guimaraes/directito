import { describe, expect, test } from 'vitest';
import { normalizeHomepagePath } from './normalize-homepage-path.js';

describe('normalizeHomepagePath', () => {
	test('returns null when disabled', () => {
		expect(normalizeHomepagePath(null)).toBeNull();
		expect(normalizeHomepagePath(undefined)).toBeNull();
		expect(normalizeHomepagePath('')).toBeNull();
		expect(normalizeHomepagePath('   ')).toBeNull();
	});

	test('accepts internal paths', () => {
		expect(normalizeHomepagePath('/content')).toBe('/content');
		expect(normalizeHomepagePath('/users')).toBe('/users');
		expect(normalizeHomepagePath('/settings/project')).toBe('/settings/project');
		expect(normalizeHomepagePath('/content/turmas/123')).toBe('/content/turmas/123');
		expect(normalizeHomepagePath('/embedded/my-site')).toBe('/embedded/my-site');
	});

	test('allows query strings and hashes on internal paths', () => {
		expect(normalizeHomepagePath('/content/foo?tab=bar')).toBe('/content/foo?tab=bar');
		expect(normalizeHomepagePath('/content/foo#section')).toBe('/content/foo#section');
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

	test('rejects schemes', () => {
		expect(normalizeHomepagePath('javascript:alert(1)')).toBeNull();
		expect(normalizeHomepagePath('data:text/html,hi')).toBeNull();
		expect(normalizeHomepagePath('/javascript:alert(1)')).toBeNull();
		expect(normalizeHomepagePath('/data:text/html,hi')).toBeNull();
	});

	test('rejects backslash attempts', () => {
		expect(normalizeHomepagePath('/\\example.com')).toBeNull();
		expect(normalizeHomepagePath('/content\\foo')).toBeNull();
		expect(normalizeHomepagePath('\\example.com')).toBeNull();
	});

	test('rejects values not starting with /', () => {
		expect(normalizeHomepagePath('content')).toBeNull();
		expect(normalizeHomepagePath('embedded/site-id')).toBeNull();
	});
});
