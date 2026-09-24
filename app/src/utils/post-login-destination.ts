import { normalizeHomepagePath } from '@directus/utils';

/**
 * Resolves the default destination after a successful login.
 *
 * Precedence: explicit redirect > settings.homepage_path > last_page > fallback.
 *
 * `homepage_path` is a POST-LOGIN default only. It must never act as a permanent
 * navigation guard: once authenticated, the user navigates freely.
 */
export function resolvePostLoginDestination(
	redirect: string | null | undefined,
	homepagePath: string | null | undefined,
	lastPage: string | null | undefined,
	fallback = '/content',
): string {
	return redirect || normalizeHomepagePath(homepagePath) || lastPage || fallback;
}
