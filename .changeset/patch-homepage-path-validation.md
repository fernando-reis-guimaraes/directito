---
'@directus/api': patch
'@directus/app': patch
'@directus/utils': patch
---

Validated `homepage_path` before persisting it: invalid values are now rejected immediately with an `INVALID_PAYLOAD` error instead of being silently ignored at login. The normalization rules moved to a shared `@directus/utils` helper reused by the API and the app.
