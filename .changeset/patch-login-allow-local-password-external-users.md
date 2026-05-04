---
'@directus/api': major
---

Local email/password login is now always allowed for users registered with an external OAuth provider, as long as the user has a password set. The `AUTH_ALLOW_LOCAL_PASSWORD_FOR_EXTERNAL_USERS` environment variable is no longer required.
