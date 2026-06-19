# Extension — Prompt Shaper Browser Extension

WXT + React browser extension that intercepts prompts on ChatGPT, Claude, and Gemini, optimises them via the backend API (or a user-supplied provider key), and displays token/cost savings.

## Directory Structure

```
apps/extension/
├── entrypoints/
│   ├── background.ts      # Service worker — caching, provider routing, messaging
│   ├── content.tsx         # Content script injected into LLM sites
│   └── popup/              # Extension popup UI (React + Tailwind)
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.html
│       └── style.css
├── utils/
│   └── config.ts           # BACKEND_URL (default http://localhost:3005)
├── assets/
│   └── tailwind.css
├── wxt.config.ts            # WXT manifest & Vite config
├── tsconfig.json
└── package.json
```

## Running Locally

```bash
# From the monorepo root
npm install

# Dev mode (Chrome)
npm run dev -w extension

# Dev mode (Firefox)
npm run dev:firefox -w extension
```

WXT opens a browser with the extension auto-loaded and hot-reloads on file changes.

### Pointing to a Different Backend

Set `WXT_BACKEND_URL` in `apps/extension/.env`:

```
WXT_BACKEND_URL=https://my-server.example.com
```

Defaults to `http://localhost:3005` when unset.

## Manifest Permissions

Configured in `wxt.config.ts`:

| Permission | Why |
|------------|-----|
| `storage` | Persist session IDs, cached prompts, provider API keys, and cache-hit counters in `chrome.storage.local` |
| `contextMenus` | Adds an "Optimize Prompt" right-click menu item on all pages |

### Host Permissions

```
*://chatgpt.com/*
*://claude.ai/*
*://gemini.google.com/*
http://localhost:3005/*
https://api.openai.com/*
https://api.anthropic.com/*
https://generativelanguage.googleapis.com/*
```

The first three allow the content script to be injected into supported LLM sites. The remaining entries let the background service worker call the local backend and (optionally) stream directly to OpenAI, Anthropic, or Gemini APIs when the user provides their own key.

## Background Service Worker (`background.ts`)

### Runtime Messaging

The service worker handles messages from the content script and popup via `browser.runtime.onMessage`. Each message carries an `action` field:

| Action | Description |
|--------|-------------|
| `trackUsage` | Forwards a prompt to `POST /api/track` and returns token count |
| `getSession` | Fetches session stats from the backend; falls back to locally persisted data when the backend is unreachable |
| `checkCache` | Looks up a fuzzy-matched cached result (≥ 95 % Levenshtein similarity, same ratio, < 24 h old) |
| `setCache` | Stores an optimised result in `chrome.storage.local` keyed by SHA-256 hash |
| `clearCache` | Removes all `cache:*` entries and resets hit counter |
| `getCacheStats` | Returns `{ entries, hits }` for the local prompt cache |
| `getProviderSettings` | Returns which provider is active and which keys are present (never exposes raw keys to content scripts) |
| `setProviderKey` | Saves an API key for `openai`, `anthropic`, or `gemini` and sets it as the preferred provider |
| `removeProviderKey` | Deletes a provider key and falls back to server-managed Gemini |

### Streaming via Provider Keys

When the user supplies their own API key, the service worker opens a long-lived port (`providerStream`) and streams the optimised prompt chunk-by-chunk directly from the provider — bypassing the backend entirely. Supported providers:

| Provider | Model | Endpoint |
|----------|-------|----------|
| OpenAI | `gpt-4o-mini` | `https://api.openai.com/v1/chat/completions` |
| Anthropic | `claude-haiku-4-5` | `https://api.anthropic.com/v1/messages` |
| Gemini | `gemini-2.5-flash-lite` | `https://generativelanguage.googleapis.com/v1beta/...` |

If no key is available the background tells the content script to fall back to the backend API.

### Prompt Cache

Optimised prompts are cached in `chrome.storage.local` to avoid redundant API calls:

- **Key**: `cache:<sha256(normalised_prompt + "::" + ratio)>`
- **Lookup**: Scans all `cache:*` entries, computes Levenshtein similarity, and returns the best match above 95 % with the same compression ratio.
- **TTL**: 24 hours — expired entries are pruned on read.
- **Stats**: A `cacheHits` counter is incremented on every cache hit and exposed via `getCacheStats`.

### Session Persistence

Session data fetched from the backend is mirrored locally (`session:<id>` in `chrome.storage.local`). If the backend goes offline, the extension serves this persisted copy so the popup can still display stats.

## Scripts

| Script | Command |
|--------|---------|
| `dev` | `wxt` (Chrome dev mode) |
| `dev:firefox` | `wxt -b firefox` |
| `build` | `wxt build` |
| `build:firefox` | `wxt build -b firefox` |
| `zip` | `wxt zip` (packageable `.zip`) |
| `zip:firefox` | `wxt zip -b firefox` |
| `compile` | `tsc --noEmit` (type-check only) |
