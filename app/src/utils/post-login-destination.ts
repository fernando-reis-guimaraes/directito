/**
 * Resolves the default destination after a successful login.
 *
 * Precedence: explicit redirect > settings.homepage_path > last_page > fallback.
 *
 * `homepage_path` is a POST-LOGIN default only. It must never act as a permanent
 * navigation guard: once authenticated, the user navigates freely.
 */

export function normalizeHomepagePath(value: string | null | undefined): string | null {
	if (value === null || value === undefined) return null;

	const trimmed = value.trim();

	if (trimmed === '') return null;

	// Must be an internal path
	if (trimmed.startsWith('/') === false) return null;

	// Reject protocol-relative URLs (//example.com) and backslash tricks (/\, /\\)
	if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null;
	if (trimmed.includes('\\')) return null;

	// Reject embedded schemes such as /javascript:alert(1) or /data:text/html,...
	// (values without a leading slash like `javascript:...` are already rejected above)
	if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return null;

	// Internal paths never contain raw whitespace
	if (/\s/.test(trimmed)) return null;

	return trimmed;
}

export function resolvePostLoginDestination(
	redirect: string | null | undefined,
	homepagePath: string | null | undefined,
	lastPage: string | null | undefined,
	fallback = '/content',
): string {
	return redirect || normalizeHomepagePath(homepagePath) || lastPage || fallback;
}
