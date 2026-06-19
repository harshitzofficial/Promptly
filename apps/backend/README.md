# Backend — Prompt Shaper API

Express + TypeScript service that compresses LLM prompts via Google Gemini (with a regex fallback) and tracks token/cost savings in SQLite.

## Directory Structure

```
apps/backend/
├── src/
│   ├── index.ts                 # Express entry — mounts routes on /api
│   ├── config/db.ts             # SQLite init & schema (better-sqlite3)
│   ├── controllers/
│   │   ├── optimize.ctrl.ts     # POST /api/optimize/stream  (SSE)
│   │   └── stats.ctrl.ts        # Pricing, session, tracking, stats endpoints
│   ├── routes/api.routes.ts     # Route definitions
│   ├── services/
│   │   ├── optimize.service.ts  # regexCompress() fallback
│   │   └── session.service.ts   # Session CRUD & history logging
│   └── utils/pricing.util.ts    # Per-platform pricing & token limits
├── Dockerfile
├── tsconfig.json
└── package.json
```

## Running Locally

```bash
# From the monorepo root (installs all workspaces)
npm install

# Start with hot-reload
npm run dev -w backend        # uses tsx watch

# Or start without watch
npm run start -w backend
```

The server listens on `http://localhost:3005` by default.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3005` | HTTP listen port |
| `GEMINI_API_KEY` | — | Required for AI-powered compression; falls back to regex when absent |
| `DB_PATH` | `src/../database.sqlite` | SQLite file path |

## API Routes

All routes are mounted under `/api`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/optimize/stream` | SSE stream — compresses a prompt via Gemini (or regex fallback). Body: `{ prompt, sessionId?, ratio? }` |
| `GET`  | `/api/pricing` | Returns per-platform pricing table |
| `POST` | `/api/pricing` | Updates pricing for a platform. Body: `{ platform, pricePerMillion }` |
| `POST` | `/api/track` | Counts tokens in a prompt and adds them to the session. Body: `{ prompt, sessionId }` |
| `GET`  | `/api/session/:sessionId` | Returns session stats: tokens used/saved, limit, remaining, cost saved |
| `GET`  | `/api/stats` | Aggregated stats with chart data. Query: `?days=7` (1–365) |
| `POST` | `/api/log-cache` | Logs a cache-hit optimisation to history. Body: `{ sessionId, prompt, compressed, originalTokens, optimizedTokens }` |
| `POST` | `/api/log-custom` | Logs a client-side optimisation (OpenAI/Anthropic). Body: `{ sessionId, prompt, compressed, originalTokens, optimizedTokens, method }` |

### Optimisation Flow (`POST /api/optimize/stream`)

1. Counts original tokens with `Gemini countTokens`.
2. Streams a compressed prompt back as `text/event-stream` SSE events (`{type:"chunk", text}` → `{type:"done", ...metrics}`).
3. On Gemini failure, falls back to `regexCompress()` — strips filler words, collapses whitespace, and streams the result word-by-word.
4. Logs history and updates session usage when a `sessionId` is provided.

## SQLite Schema

Initialised automatically on first run (`config/db.ts`).

```sql
sessions (sessionId TEXT PK, tokensUsed INT, tokensSaved INT, lastReset INT)
history  (id INT PK, sessionId TEXT, prompt TEXT, compressed TEXT,
          originalTokens INT, optimizedTokens INT, costSaved REAL,
          timestamp INT, method TEXT)
pricing  (platform TEXT PK, pricePerMillion REAL)
```

Default pricing rows: `chatgpt 5.00`, `claude 3.00`, `gemini 1.25`, `default 1.00` (USD per million tokens).

### Platform Token Limits

Derived from the session ID suffix (see `pricing.util.ts`):

| Suffix | Limit | Refresh |
|--------|-------|---------|
| `-chatgpt` | 40 000 | 3 h |
| `-claude` | 200 000 | 5 h |
| `-gemini` | 1 000 000 | 24 h |
| *(other)* | 10 000 | 24 h |

## Docker

```bash
# Build & run via docker compose (from repo root)
GEMINI_API_KEY=<key> docker compose up --build
```

The `Dockerfile` uses `node:20-alpine`, installs native build tools for `better-sqlite3`, compiles TypeScript, and runs `node dist/main.js` on port 3005. A named volume (`prompt_shaper_data`) persists the SQLite database across container restarts.

## Scripts

| Script | Command |
|--------|---------|
| `dev` | `tsx watch src/index.ts` |
| `start` | `tsx src/index.ts` |
| `build` | `tsc` (outputs to `dist/`) |
