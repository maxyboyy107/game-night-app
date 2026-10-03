---
name: API response caching
description: Why games.io API reads bypass browser caching and conditional validators.
---

Keep API JSON responses uncached unless the client has explicit conditional-request support that can reuse a previously cached body. The generated client treats HTTP 304 as an error and cannot render it as a complete JSON response.

**Why:** Express can return an empty 304 for an ETag-matching profile request; the profile UI then handles the request as a load failure instead of receiving its data.

**How to apply:** When changing API cache headers or the shared fetch wrapper, preserve `no-store` behavior or add end-to-end handling for validators and cached representations.