---
'@directus/api': patch
'@directus/app': patch
'@directus/types': patch
---

Removed the owner-information requirement so absent owner data is a valid normal state. Deleted the license/owner popup trigger, decoupled the initial setup admin email from optional owner metadata, removed Directus-controlled outbound links from the setup form, and removed the usage, organization, license-acceptance, and product-updates prompts from setup and the owner editor.
