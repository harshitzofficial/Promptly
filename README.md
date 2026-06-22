# Promptly 

> Enhance your AI prompts directly in the browser — no copy-pasting, no context switching.

Promptly is a **Manifest V3 Chrome Extension** built with the [WXT framework](https://wxt.dev/), React 19, and Tailwind CSS v4. It injects a seamless UI overlay into ChatGPT, Claude, and Gemini, allowing you to optimize prompts in one click using OpenAI, Anthropic, Google Gemini, or a local Ollama instance — all without your API keys ever leaving your machine.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
  - [Three-Layer Extension Model](#three-layer-extension-model)
  - [Component Hierarchy](#component-hierarchy)
  - [Subsystem Relationships](#subsystem-relationships)
- [Data Flow](#data-flow)
  - [Prompt Optimization Sequence](#prompt-optimization-sequence)
  - [Caching Strategy](#caching-strategy)
  - [Settings Propagation](#settings-propagation)
- [AI Provider Integration](#ai-provider-integration)
- [Prompt Cache & History](#prompt-cache--history)
- [Message Passing API](#message-passing-api)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Build Commands](#build-commands)
  - [Loading in Browser](#loading-in-browser)
- [Configuration](#configuration)
- [Permissions](#permissions)

---

## Features

- **One-Click Prompt Enhancement** — Quick Action Pills float above the active textarea with actions: *Optimize*, *Fix Grammar*, *Make Professional*, *Summarize*
- **Keyboard Shortcut** — `Ctrl+Shift+O` triggers optimization from anywhere on the page
- **Right-Click Context Menu** — "✨ Optimize Prompt" available via browser context menu
- **Real-Time Streaming** — Optimized text streams token-by-token directly into the textarea, mimicking native AI UX
- **Multi-Provider Support** — OpenAI (GPT-4o mini), Anthropic (Claude Haiku), Google Gemini, and local Ollama
- **Smart Prompt Cache** — SHA-256 hashing + Levenshtein fuzzy matching (≥95% similarity) with 24-hour TTL
- **Prompt History** — 15-entry ring buffer with re-injection into the active tab
- **Tone & Detail Control** — Professional, Creative, Technical, Simple tones; Concise/Balanced/Comprehensive detail levels
- **Shadow DOM Isolation** — Extension UI never conflicts with host page styles
- **Privacy First** — API keys stored locally in `chrome.storage.local`, never sent to any intermediary server

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [WXT](https://wxt.dev/) v0.20+ (Web Extension Tooling) |
| UI | React 19 + TypeScript 5.9 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Icons | `lucide-react` |
| Charts | `recharts` |
| Build | Vite (via WXT) |
| Target | Chrome Manifest V3 / Firefox MV2 |

---

## Project Structure

```
promptly/
├── entrypoints/
│   ├── background.ts        # Background Service Worker (AI calls, cache, message hub)
│   ├── content.tsx          # Content Script (Shadow DOM UI injection)
│   └── popup/
│       ├── App.tsx          # Popup root — tab navigation (History / Style / Settings)
│       ├── main.tsx         # React entry point
│       ├── index.html       # Popup HTML shell
│       └── style.css        # Tailwind global styles for popup
├── components/
│   ├── QuickActionPills.tsx # Floating action buttons above textarea
│   ├── SidebarSlider.tsx    # Hover-activated tone/detail panel
│   ├── ToastNotification.tsx# Success/error feedback toasts
│   ├── HistoryList.tsx      # Popup history tab with re-injection
│   ├── PopupStyleSelector.tsx # Tone & detail level selector
│   └── ProviderSettings.tsx # API key management UI
├── hooks/
│   └── useSettings.ts       # Reactive settings hook (tone, detail, custom instructions)
├── utils/
│   └── dom.ts               # Platform-specific DOM selectors & text manipulation
├── assets/
│   └── tailwind.css         # Tailwind CSS entry
├── wxt.config.ts            # WXT + Vite + manifest configuration
├── package.json
└── tsconfig.json
```

---

## Architecture Overview

### Three-Layer Extension Model

Promptly follows the standard Chrome MV3 three-context architecture, with each layer having strict responsibilities:

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER TOOLBAR                         │
│                   ┌──────────────┐                          │
│                   │   Popup UI   │  (450×600px React App)   │
│                   │  App.tsx     │  History / Style /       │
│                   │              │  Settings tabs           │
│                   └──────┬───────┘                          │
│                          │ runtime.sendMessage              │
│                          ▼                                  │
│          ┌───────────────────────────────┐                  │
│          │  Background Service Worker    │                  │
│          │  background.ts                │                  │
│          │  • AI Provider routing        │                  │
│          │  • SHA-256 Prompt Cache       │                  │
│          │  • History ring buffer        │                  │
│          │  • API key management         │                  │
│          └──────────────┬────────────────┘                  │
│                         │ runtime.Port (providerStream)     │
│                         ▼                                   │
│          ┌───────────────────────────────┐                  │
│          │  Content Script               │                  │
│          │  content.tsx                  │                  │
│          │  • Shadow DOM UI              │                  │
│          │  • QuickActionPills           │                  │
│          │  • SidebarSlider              │                  │
│          │  • ToastNotification          │                  │
│          │  • DOM read/write (dom.ts)    │                  │
│          └───────────────────────────────┘                  │
│               Injected into: chatgpt.com                    │
│                             claude.ai                       │
│                             gemini.google.com               │
└─────────────────────────────────────────────────────────────┘
```

```mermaid
graph TB
    subgraph "Browser Environment"
        subgraph "Popup UI"
            POPUP["Popup Interface"]
            POPUP_SETTINGS["Settings Management"]
            POPUP_HISTORY["History Display"]
        end

        subgraph "Content Script"
            CS_SHADOW["Shadow DOM UI"]
            CS_PILLS["Quick Action Pills"]
            CS_SIDEBAR["Sidebar Slider"]
            CS_TOAST["Toast Notifications"]
            CS_DOM["DOM Manipulation"]
        end

        subgraph "Background Service Worker"
            BG_MSG["Message Handler"]
            BG_CACHE["Prompt Cache"]
            BG_KEYS["API Key Storage"]
            BG_STREAM["Streaming Handler"]
            BG_MENU["Context Menu"]
        end

        subgraph "Browser Storage"
            STORAGE["chrome.storage.local"]
        end
    end

    subgraph "External AI Providers"
        OPENAI["OpenAI API"]
        ANTHROPIC["Anthropic API"]
        GEMINI["Gemini API"]
        OLLAMA["Ollama API"]
    end

    subgraph "Target Platforms"
        CHATGPT["ChatGPT"]
        CLAUDE["Claude"]
        GEMINI_WEB["Gemini Web"]
    end

    %% Popup Communication
    POPUP -- "sendMessage/getHistory" --> BG_MSG
    POPUP -- "setProviderKey" --> BG_KEYS
    BG_MSG -- "history data" --> POPUP_HISTORY

    %% Content Script Communication
    CS_SHADOW -- "checkCache" --> BG_MSG
    BG_MSG -- "cache hit/miss" --> CS_SHADOW
    CS_SHADOW -- "providerStream port" --> BG_STREAM
    BG_STREAM -- "streaming chunks" --> CS_SHADOW
    CS_DOM -- "read/write textarea" --> CHATGPT
    CS_DOM -- "read/write textarea" --> CLAUDE
    CS_DOM -- "read/write textarea" --> GEMINI_WEB

    %% Background External Communication
    BG_STREAM -- "API requests" --> OPENAI
    BG_STREAM -- "API requests" --> ANTHROPIC
    BG_STREAM -- "API requests" --> GEMINI
    BG_STREAM -- "API requests" --> OLLAMA

    %% Storage Communication
    BG_CACHE -- "get/set cache" --> STORAGE
    BG_KEYS -- "get/set API keys" --> STORAGE

    %% Context Menu
    BG_MENU -- "trigger-optimize" --> CS_SHADOW

    %% Internal Content Script
    CS_PILLS -- "handleOptimize" --> CS_SHADOW
    CS_SIDEBAR -- "tone selection" --> CS_SHADOW
    CS_TOAST -- "notifications" --> CS_SHADOW
```

### Component Hierarchy

```mermaid
graph TD
    subgraph "Popup Entrypoint"
        HTML["index.html"] --> MAIN["main.tsx"]
        MAIN --> APP["App.tsx"]
    end

    subgraph "Popup Tabs"
        APP -->|"history"| HL["HistoryList"]
        APP -->|"style"| PSS["PopupStyleSelector"]
        APP -->|"settings"| PS["ProviderSettings"]
    end

    subgraph "Content Script Entrypoint"
        CS["defineContentScript"] --> SHADOW["createShadowRootUi"]
        SHADOW --> CSAPP["App Component"]
        CSAPP --> QAP["QuickActionPills"]
        CSAPP --> SS["SidebarSlider"]
        CSAPP --> TN["ToastNotification"]
        QAP -.->|uses| DOM["utils/dom.ts"]
        CSAPP -.->|uses| DOM
    end

    subgraph "Shared"
        PSS -.->|useSettings| HOOK["hooks/useSettings.ts"]
        SS -.->|useSettings| HOOK
    end
```

### Subsystem Relationships

```mermaid
graph TD
    subgraph "Extension Popup"
        P_UI["Popup UI (App.tsx)"]
        P_Hist["History Tab"]
        P_Set["Settings Tab"]
    end

    subgraph "Background Context"
        BSW["background.ts (Service Worker)"]
        Cache["SHA-256 Cache Manager"]
        Prov["AI Provider Router"]
    end

    subgraph "Content Script (Host Page)"
        ShadowDOM["Shadow DOM Root"]
        Pills["QuickActionPills"]
        Slider["SidebarSlider"]
    end

    P_Set -- "setProviderKey" --> BSW
    BSW -- "storage.onChanged" --> P_UI
    Pills -- "providerStream port" --> BSW
    BSW -- "inject-prompt" --> ShadowDOM
    BSW -- "fetch (streaming)" --> AI_API["External AI APIs"]
    Cache -- "chrome.storage.local" --> STORE[("Local Storage")]
```

---

## Data Flow

### Prompt Optimization Sequence

```mermaid
sequenceDiagram
    participant User
    participant CS as Content Script (content.tsx)
    participant BG as Background Worker (background.ts)
    participant Storage as chrome.storage.local
    participant AI as AI Provider

    User->>CS: Clicks Pill / Ctrl+Shift+O
    CS->>CS: getActiveEditable() [utils/dom.ts]
    CS->>BG: sendMessage({ action: 'checkCache', prompt })
    BG->>BG: hashPrompt(prompt) — SHA-256
    BG->>Storage: get(null) — all keys
    Storage-->>BG: All cache entries

    alt Cache Hit (similarity >= 0.95)
        BG-->>CS: { hit: true, data: { optimizedPrompt } }
        CS->>CS: setEditableText(target, optimizedPrompt)
        CS->>User: ToastNotification (Cache Hit)
    else Cache Miss
        CS->>BG: connect({ name: 'providerStream' })
        BG->>BG: getProviderSettings()
        BG->>BG: SYSTEM_INSTRUCTION(tone) + detailInstruction
        BG->>AI: POST (streaming request)
        loop Stream Chunks
            AI-->>BG: SSE / NDJSON chunk
            BG-->>CS: port.postMessage({ type: 'chunk', text })
            CS->>CS: setEditableText(target, partialText)
        end
        BG-->>CS: port.postMessage({ type: 'done', method, fullText })
        CS->>BG: sendMessage({ action: 'setCache', ... })
        BG->>Storage: set({ 'cache:hash': data })
        BG->>Storage: set({ localHistory: [...] })
        CS->>User: ToastNotification (Provider icon)
    end
```

### Caching Strategy

The cache uses a two-step lookup to maximize hit rates while tolerating minor prompt variations:

```mermaid
graph TD
    START["getCachedResult(prompt)"] --> FETCH["storage.local.get(null)"]
    FETCH --> ITER["Iterate keys starting with 'cache:'"]
    ITER --> TTL{"Age > 24 hours?"}
    TTL -- "Yes" --> DEL["Remove expired entry"]
    TTL -- "No" --> SIM["similarity(prompt, cached.prompt)"]
    SIM --> THRESH{"Score >= 0.95?"}
    THRESH -- "Yes" --> BEST["Track as bestMatch"]
    THRESH -- "No" --> ITER
    BEST --> RETURN["Return bestMatch"]
    DEL --> ITER
```

| Step | Detail |
|---|---|
| **Normalization** | Trim, collapse whitespace, append `::v7` version suffix |
| **Hashing** | `crypto.subtle.digest('SHA-256', ...)` for exact-match key |
| **Fuzzy Match** | Levenshtein distance: `1 - (dist / max(len_a, len_b))` |
| **Threshold** | ≥ 0.95 similarity required for a cache hit |
| **TTL** | 86,400,000 ms (24 hours); expired entries auto-removed |

### Settings Propagation

```mermaid
graph TD
    subgraph "Content Script"
        A["SidebarSlider.tsx"] -- "updateSetting('tone', id)" --> B["useSettings Hook"]
    end
    subgraph "Browser Storage"
        B -- "storage.local.set" --> C[("chrome.storage.local")]
    end
    subgraph "Background"
        C -- "storage.local.get" --> D["streamProvider()"]
        D -- "injects toneGuide" --> E["SYSTEM_INSTRUCTION()"]
        E --> F["AI Provider API"]
    end
    subgraph "Popup"
        C -. "storage.onChanged" .-> G["PopupStyleSelector.tsx"]
    end
```

The `useSettings` hook in `hooks/useSettings.ts` is the single source of truth for user preferences. It listens to `browser.storage.onChanged` so that changes made in the Sidebar Slider are immediately reflected in the Popup's Style tab, and vice versa.

---

## AI Provider Integration

All API calls are made **directly from the Background Service Worker** — API keys never leave the local machine.

| Provider | Model | Endpoint | Stream Format |
|---|---|---|---|
| **Gemini** | `gemini-3.5-flash` | `generativelanguage.googleapis.com/...streamGenerateContent` | Server-Sent Events |
| **OpenAI** | `gpt-4o-mini` | `api.openai.com/v1/chat/completions` | Server-Sent Events (`data:` prefix) |
| **Anthropic** | `claude-haiku-4-5` | `api.anthropic.com/v1/messages` | Server-Sent Events (`content_block_delta`) |
| **Ollama** | User-defined (e.g. `llama3`) | `localhost:11434/api/generate` | NDJSON (newline-delimited JSON) |

### Provider Routing Logic

```mermaid
graph TD
    MSG["providerStream port message"] --> CACHE{"Cache Hit?"}
    CACHE -- "Yes" --> SERVE["Serve from cache"]
    CACHE -- "No" --> PREF["getProviderSettings()"]
    PREF --> SWITCH{"preferredProvider"}
    SWITCH -- "openai" --> OAI["streamProvider('openai', ...)"]
    SWITCH -- "anthropic" --> ANT["streamProvider('anthropic', ...)"]
    SWITCH -- "gemini" --> GEM["streamProvider('gemini', ...)"]
    SWITCH -- "ollama" --> OLL["streamProvider('ollama', ...)"]
    OAI & ANT & GEM & OLL --> PORT["port.postMessage({ type: 'chunk' })"]
    PORT --> DONE["port.postMessage({ type: 'done' })"]
```

### Quick Action Overrides

When a Quick Action Pill is clicked (not the main Optimize button), an `actionOverride` string is passed through the stream, replacing the default system prompt:

| Action | System Behavior |
|---|---|
| `Fix Grammar` | Professional editor — fix spelling/grammar/punctuation only |
| `Make Professional` | Corporate communicator — rewrite for formal tone |
| `Summarize` | Expert summarizer — output a concise summary |
| *(default)* | World-class Prompt Engineer — full prompt expansion |

### Tone Instructions

| Tone ID | Behavior |
|---|---|
| `professional` | Formal, structured, business-appropriate with clear headings |
| `creative` | Imaginative, expressive, encourages storytelling |
| `technical` | Precise, expert-level, includes constraints and edge cases |
| `simple` | Plain-English, jargon-free, easy to understand |

---

## Prompt Cache & History

### Cache Storage Schema

Each cache entry is stored under the key `cache:<sha256hash>`:

```json
{
  "prompt": "original user prompt",
  "optimizedPrompt": "enhanced output",
  "method": "gemini-agent",
  "cachedAt": 1718000000000
}
```

### History Ring Buffer

The `localHistory` array in `chrome.storage.local` stores the last **15** enhancements:

| Field | Type | Description |
|---|---|---|
| `id` | `number` | Timestamp-based unique ID |
| `prompt` | `string` | Original user input |
| `compressed` | `string` | Final optimized output |
| `method` | `string` | Source: `cache`, `openai`, `anthropic`, `gemini-agent`, `ollama` |
| `timestamp` | `number` | Unix epoch of enhancement |

History entries are displayed in the Popup's **History Tab** with color-coded method badges:
- **Purple** — `gemini-agent`
- **Green** — `cache`
- **Orange** — other providers

---

## Message Passing API

Communication between extension contexts uses `browser.runtime.sendMessage` (one-shot) and `browser.runtime.connect` (long-lived port for streaming).

### One-Shot Messages (`runtime.sendMessage`)

| Action | Direction | Description |
|---|---|---|
| `checkCache` | Content → Background | Check if prompt has a cached result |
| `setCache` | Content → Background | Store a new optimization result |
| `clearCache` | Popup → Background | Remove all `cache:` keys from storage |
| `getHistory` | Popup → Background | Retrieve `localHistory` array |
| `getProviderSettings` | Any → Background | Get provider config (keys masked) |
| `setProviderKey` | Popup → Background | Save an API key and set preferred provider |
| `removeProviderKey` | Popup → Background | Delete a stored API key |
| `trigger-optimize` | Background → Content | Trigger optimization (from context menu) |
| `inject-prompt` | Popup → Content | Insert a history entry into the active textarea |

### Long-Lived Port (`providerStream`)

Used for streaming AI responses chunk-by-chunk:

```mermaid

sequenceDiagram

    participant CS as Content Script

    participant BW as Background Worker



    CS->>BW: connect({ name: "providerStream" })

    CS->>BW: port.postMessage({ prompt, actionOverride })



    BW->>BW: fetch(AI API)\n(streaming loop)



    loop Stream chunks

        BW-->>CS: { type: "chunk", text: "..." }

    end



    BW-->>CS: { type: "done", method, fullText }



    alt Error

        BW-->>CS: { type: "error", error: "..." }

    end

```

---

## Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** (bundled with Node.js)

### Installation

```bash
git clone https://github.com/harshitzofficial/Promptly.git
cd Promptly
npm install
```

> `postinstall` automatically runs `wxt prepare` to generate TypeScript types.

### Environment Variables

Create a `.env` file in the project root:

```env
WXT_BACKEND_URL=http://localhost:3005
```

### Build Commands

| Command | Description |
|---|---|
| `npm run dev` | Start WXT dev server for Chrome (hot reload) |
| `npm run dev:firefox` | Start WXT dev server for Firefox |
| `npm run build` | Production build → `.output/chrome-mv3/` |
| `npm run build:firefox` | Production build for Firefox |
| `npm run zip` | Package extension as `.zip` for distribution |
| `npm run zip:firefox` | Package Firefox extension |
| `npm run compile` | TypeScript type-check (no emit) |

### Loading in Browser

**Chrome / Edge / Brave:**
1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `.output/chrome-mv3/`

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` inside `.output/firefox-mv2/`

---

## Configuration

Open the extension popup from the browser toolbar and navigate to the **Settings** tab to configure your AI provider:

| Provider | What to enter |
|---|---|
| Google Gemini | Gemini API key from [Google AI Studio](https://aistudio.google.com/) |
| OpenAI | OpenAI API key (`sk-...`) |
| Anthropic | Anthropic API key |
| Ollama | Model name (e.g. `llama3`, `mistral`) — requires Ollama running locally on port `11434` |

Use the **Style** tab to set your preferred **Tone** and **Detail Level**. These settings sync instantly between the Popup and the in-page Sidebar Slider.

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist API keys, cache, history, and user preferences |
| `contextMenus` | Register the "✨ Optimize Prompt" right-click menu item |
| `*://chatgpt.com/*` | Inject content script into ChatGPT |
| `*://claude.ai/*` | Inject content script into Claude |
| `*://gemini.google.com/*` | Inject content script into Gemini |
| `https://api.openai.com/*` | Direct API calls from background worker |
| `https://api.anthropic.com/*` | Direct API calls from background worker |
| `https://generativelanguage.googleapis.com/*` | Direct API calls from background worker |
| `http://localhost:3005/*` | Local development backend |

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/harshitzofficial/Promptly)
