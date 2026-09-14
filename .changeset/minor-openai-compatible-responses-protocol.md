---
'@directus/api': minor
'@directus/ai': minor
'@directus/types': patch
'@directus/app': patch
---

Added Responses API transport support to the OpenAI-Compatible AI provider. A new Protocol setting selects between Chat Completions (default, unchanged) and Responses (backed by `@ai-sdk/openai` against the configured base URL), and a new Conversation Session Header setting injects the stable conversation ID (sent by the client and regenerated on Clear Conversation) as a dynamic request header on every model call. Also fixed the AI Assistant icon rendering in Safari/WebKit by giving its SVG paths literal `d` attributes.
