# Embedded Sites

Generic capability for mounting any number of external/internal sites as independent icons in the left Module Bar. Each
configured site keeps the normal Directito shell (Module Bar, header, SPA back/forward) and renders inside a single
reusable iframe view at `/embedded/:siteId`.

There is no per-application implementation. Configuration is data: N Module Bar link entries produce N icons.

## Adding an embedded Module Bar entry

Project Settings → Module Bar → Custom Link:

- **Name** — label and tooltip, e.g. `Grafana`.
- **Icon** — Material icon, e.g. `monitoring`.
- **URL** — absolute `http(s)` URL, e.g. `https://grafana.example.com`.
- **Display** — `Open externally` (legacy behavior, new tab) or `Inside Directito` (embedded iframe at
  `/embedded/:siteId`).
- **Authentication** — only relevant for embedded entries (see below).

Stored shape (extends the existing `module_bar` link format; legacy entries without the new properties keep behaving as
external links):

```json
{
	"type": "link",
	"id": "<nanoid>",
	"name": "Grafana",
	"icon": "monitoring",
	"url": "https://grafana.example.com",
	"enabled": true,
	"display": "embedded",
	"authentication": "identity"
}
```

## Authentication modes

### None (`none`)

The embedded site receives nothing about the Directito user. No handshake runs. Use for public/external sites.

### Identity Only (`identity`)

The embedded application learns who the logged-in user is, without receiving any API credentials:

```json
{
	"authentication": "identity",
	"user": {
		"id": "...",
		"role": "...",
		"email": "...",
		"first_name": "...",
		"last_name": "...",
		"language": "..."
	}
}
```

### Full Directito API Access (`directus-api`)

The embedded application receives a real, short-lived Directito bearer token for the currently logged-in user, usable
directly against the normal API:

```json
{
	"authentication": "directus-api",
	"api_url": "https://directito.example.com",
	"access_token": "<delegated-access-token>",
	"expires": 900000,
	"user": { "...": "same identity snapshot as above" }
}
```

The token is signed with the same secret, payload shape, and TTL semantics as a normal login access token
(`ACCESS_TOKEN_TTL`, default 15 minutes), and is verified by the existing authentication middleware. Effective
permissions are identical to the user's normal token: same role, same policies, same admin/app access. Nothing is
reduced and nothing is escalated; requests resolve current role/access state at issuance time. When the token expires,
the iframe requests another one through the handshake — the user does not log in again while the Studio session is
valid, and no refresh token is ever exposed to the iframe.

## iframe handshake (frontend integration)

The parent never pushes credentials unprompted and never uses `targetOrigin='*'`.

```ts
const DIRECTITO_ORIGIN = 'https://directito.example.com';

window.parent.postMessage({ type: 'directito:embedded-ready' }, DIRECTITO_ORIGIN);

window.addEventListener('message', async (event) => {
	if (event.origin !== DIRECTITO_ORIGIN) return;
	if (event.data?.type !== 'directito:embedded-session') return;

	const code: string = event.data.code;

	const session = await fetch(`${DIRECTITO_ORIGIN}/embedded-sites/session/redeem`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ site_id: '<module-bar-entry-id>', code }),
	}).then((res) => res.json());

	// session.access_token is a normal Directito bearer token:
	const me = await fetch(`${session.api_url}/users/me`, {
		headers: { Authorization: `Bearer ${session.access_token}` },
	}).then((res) => res.json());
});
```

Renewal before expiry:

```ts
window.parent.postMessage({ type: 'directito:embedded-refresh' }, DIRECTITO_ORIGIN);
// A fresh one-time code arrives via the same `directito:embedded-session` message.
```

## Backend integration

The one-time code is opaque and redeemable from anywhere, so an embedded application can forward it to its own backend
instead of redeeming in the browser:

```text
Directito parent → iframe frontend → application backend → Directito redeem
→ delegated bearer token → normal Directito API calls
```

`POST /embedded-sites/session/redeem` accepts `{ site_id, code }` with no prior authentication (the single-use,
30-second, site-bound code is the credential) and returns the same payload as above. The backend then calls the API with
`Authorization: Bearer <delegated-access-token>`, e.g. `GET /items/example`.

## Endpoints

- `POST /embedded-sites/session` — body `{ site_id }`. Requires an authenticated Studio session. Returns
  `{ code, expires_in }`. Rejected for `none` entries.
- `POST /embedded-sites/session/redeem` — body `{ site_id, code }`. Returns the identity or identity-plus-token payload.
  Codes are cryptographically random, single-use, ~30s TTL, and bound to the user, the configured entry, and its
  authentication mode. A code minted for site A never redeems as site B.

## CORS

Cross-origin embedded apps calling the API directly need the existing CORS settings (no parallel system was added):

```env
CORS_ENABLED=true
CORS_ORIGIN=https://app.example.com
```

`Authorization` is already in the default `CORS_ALLOWED_HEADERS`.

## CSP

Configured embedded origins must be allowed to frame the app shell content. The existing CSP mechanism is reused — no
global disable:

```env
CONTENT_SECURITY_POLICY__FRAME_SRC=https://grafana.example.com https://chat.example.com
```

## `frame-ancestors` and framing limitations

If the target sends `X-Frame-Options: DENY/SAMEORIGIN` or a `Content-Security-Policy: frame-ancestors` list that
excludes Directito, the browser refuses to render it and Directito cannot bypass that. The administrator must allow
Directito as a frame ancestor in the target application, e.g.
`Content-Security-Policy: frame-ancestors https://directito.example.com`. The embedded view keeps an "open externally"
action for such cases.

## Security notes

- Bearer tokens never appear in iframe URLs or query strings.
- No refresh tokens are exposed to embedded content.
- `postMessage` always uses the exact configured site origin.
- Only `http:`/`https:` URLs can be embedded; `javascript:`, `data:`, and other schemes are rejected server-side.
- One-time codes and access tokens are never logged.
- `directus-api` delegation is intentional when an administrator configures it: the token carries the user's real
  permissions.
