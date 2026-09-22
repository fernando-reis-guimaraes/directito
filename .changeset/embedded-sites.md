---
'@directus/api': minor
'@directus/app': minor
'@directus/types': patch
---

Added generic Embedded Sites support to the Module Bar. Custom links gained `display` (`external` / `embedded`) and `authentication` (`none` / `identity` / `directus-api`) options so administrators can mount any number of independent sites inside Directito. Embedded entries render in a reusable `/embedded/:siteId` iframe view with a `postMessage` session handshake backed by single-use, short-lived, site-bound exchange codes (`POST /embedded-sites/session`, `POST /embedded-sites/session/redeem`). `directus-api` mode issues a real short-lived bearer token through the shared access-token signing path, preserving the user's normal permissions. Legacy links without the new properties kept working unchanged as external links.
