---
'@directus/app': minor
---

Switching modules (Content, Users, Files, Insights, Settings, …) now always reopens the left navigation, as does clicking the current module's icon again. Navigating within the same module leaves the collapsed/expanded choice untouched. The navigation performed immediately after login is the only exception: it still obeys the configured `homepage_navbar_open` value, which is applied after the login redirect settles. Mobile drawer behavior is unchanged.
