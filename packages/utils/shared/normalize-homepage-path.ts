/**
 * Normalize a configured homepage path.
 *
 * Returns the trimmed internal path, or `null` when the feature is disabled
 * (`null`, `undefined`, empty or whitespace-only) or the value is not a safe
 * internal path.
 *
 * A safe value must start with a single `/` (rejecting protocol-relative
 * `//...`, absolute URLs such as `http(s)://...`, and anything else not
 * starting with `/`), must not contain backslashes, must not embed a scheme
 * such as `javascript:` or `data:`, and must not contain raw whitespace.
 * Query strings and hashes on internal paths are allowed, e.g.
 * `/content/foo?tab=bar` or `/embedded/my-site#section`.
 *
 * The route is intentionally not required to exist: extensions can register
 * routes dynamically.
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
