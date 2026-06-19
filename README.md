# Prompt Shaper

LLM prompt optimisation toolkit — compresses prompts to cut token costs while preserving intent. Ships as a browser extension backed by an Express API.

## Monorepo Layout

```
prompt-shaper/
├── apps/
│   ├── backend/      # Express + TypeScript API  (SQLite, Gemini, tiktoken)
│   └── extension/    # WXT + React browser extension (Chrome / Firefox)
├── docker-compose.yml
└── package.json      # npm workspaces root
```

The root `package.json` declares `apps/*` as npm workspaces. All workspace dependencies are installed in one pass from the root.

## Quick Start

```bash
# 1. Install every workspace
npm install

# 2. Run backend + extension together (uses concurrently)
npm run dev
```

| Root script      | What it does |
|------------------|--------------|
| `npm run dev`    | Starts `backend` (tsx watch) **and** `extension` (wxt dev) in parallel via `concurrently` |
| `npm run build`  | Runs `build` in every workspace that defines one |
| `npm run install:all` | Alias for `npm install` (installs all workspaces) |

## Running with Docker

The backend can also run as a container:

```bash
# Provide a Gemini API key for AI-powered compression
GEMINI_API_KEY=<key> docker compose up --build
```

This builds the image from `apps/backend/Dockerfile`, exposes port **3005**, and mounts a named volume for the SQLite database.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Google Generative AI key used by the backend for prompt compression |
| `PORT` | `3005` | Port the backend listens on |
| `DB_PATH` | `<backend>/database.sqlite` | Path to the SQLite file |

## Further Reading

- [`apps/backend/README.md`](apps/backend/README.md) — API routes, database schema, Docker details
- [`apps/extension/README.md`](apps/extension/README.md) — extension permissions, caching, provider key management
