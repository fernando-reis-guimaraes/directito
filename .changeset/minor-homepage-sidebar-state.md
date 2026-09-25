---
'@directus/api': minor
'@directus/app': minor
'@directus/types': minor
---

Added two `directus_settings` checkboxes applied once after login: `homepage_navbar_open` (left navigation expanded or collapsed) and `homepage_sidebar_open` (right sidebar expanded or collapsed). Both default to open, preserving the previous behavior, and never act as a navigation guard.
