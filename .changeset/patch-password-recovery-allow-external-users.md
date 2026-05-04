---
'@directus/api': patch
---

Removed the guard that prevented users with external OAuth providers from requesting a password reset. Users with an external provider (e.g. Google) can now use the password recovery flow without requiring `AUTH_ALLOW_LOCAL_PASSWORD_FOR_EXTERNAL_USERS` to be set.
