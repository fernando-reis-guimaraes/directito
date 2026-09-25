# Homepage Path

A minimal, generic global setting that defines the internal Data Studio path opened after a successful login.

This is not tied to any particular feature: not to Module Bar links, modules, Embedded Sites, or any extension. The
configured value is simply an arbitrary internal Data Studio route — including routes registered dynamically by
extensions in the future.

## Setting

Project Settings → `Homepage Path` (`homepage_path` on `directus_settings`, nullable):

```text
homepage_path = /content
homepage_path = /embedded/example
homepage_path = /content/turmas/123
```

- `null` or empty = feature disabled; normal Directus behavior is preserved.
- Non-empty = internal Data Studio path used as the default destination after login.
- Any valid internal route is accepted (`/content`, `/users`, `/embedded/<site-id>`, `/content/turmas/123`,
  paths with query strings or hashes). The route is not required to exist at validation time.
- Values are validated **before persisting**: saving an invalid value (`https://…`, `//…`, `javascript:`/`data:`
  schemes, backslashes, or anything not starting with a single `/`) fails immediately with an `INVALID_PAYLOAD`
  error. Empty or whitespace-only input is stored as `null` (disabled).

## Post-login precedence

```text
explicit redirect → homepage_path → last_page → /content
```

- An explicit redirect requested by the authentication flow always wins. Example: visiting `/settings/users` while
  logged out still returns to `/settings/users` after login, regardless of `homepage_path`.
- With no explicit redirect, `homepage_path` overrides the user's `last_page`.
- `null`/empty preserves the legacy `redirect → last_page → /content` behavior.

## Post-login sidebars

Two checkboxes next to `Homepage Path` define the panel state applied once after a successful login:

- `homepage_navbar_open` — left navigation expanded (`true`) or collapsed (`false`).
- `homepage_sidebar_open` — right sidebar expanded (`true`) or collapsed (`false`).

Both default to `true` (open), preserving the previous behavior. Like `homepage_path`, they are a post-login
default only, not a navigation guard: after login the user can freely expand/collapse both panels, and refreshing
another page never re-applies them. Unknown/`null` values (e.g. a settings row created before the migration)
preserve the user's stored preference instead of forcing a state.

## Module navigation always reopens the left navigation

Switching modules (Content, User Directory, File Library, Insights, Settings, Embedded Sites, …) always expands
the left navigation, as does clicking the current module's icon again. Navigating within the same module
(e.g. from a collection list to an item) leaves the user's collapsed/expanded choice untouched.

The only exception is the navigation performed immediately after login, which obeys the configured
`homepage_navbar_open` value instead: the configured post-login state is applied after the login redirect
settles, so it always wins over the auto-reopen above. On small screens the existing behavior is unchanged:
the navigation stays a drawer that closes on every route change.

## Properties

- **Global**: one value for the whole project. No per-user or per-role homepages.
- **Applied after login only**: it is a post-login default destination, not a navigation guard. Once authenticated,
  users navigate freely; refreshing another page never sends them back to `homepage_path`.
- **Safe**: values are trimmed and must be internal paths (start with a single `/`). Absolute URLs (`https://…`,
  `http://…`), protocol-relative URLs (`//…`), `javascript:`/`data:` schemes, and backslash tricks are rejected, so
  the setting can never become an open redirect.

## Embedded Sites

Pointing the setting at an embedded route works unchanged:

```text
homepage_path = /embedded/<siteId>
```

After a normal login the internal embedded route opens with the existing iframe rendering and session/authentication
bridge untouched.
