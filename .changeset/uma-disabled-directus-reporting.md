---
'@directus/api': patch
'@directus/env': patch
---

Disabled outbound Directus telemetry and owner/compliance reporting unconditionally under UMA fork policy, including reporting jobs and request counters. Preserved local owner settings and defaulted TELEMETRY to false while retaining environment compatibility.
