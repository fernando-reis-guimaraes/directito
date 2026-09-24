---
'@directus/api': minor
'@directus/app': minor
'@directus/types': minor
---

Added a global `homepage_path` project setting: a nullable internal Data Studio path used as the default destination after login (precedence: explicit redirect → `homepage_path` → `last_page` → `/content`). Null/empty preserves the previous behavior.
