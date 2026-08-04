# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Adinn Design Work Allocation — an internal web app for design task assignment, acceptance/decline workflow, status tracking, reporting, and admin management across three roles: Admin, Business Developer (BD), and Designer. Node/Express backend, React (no framework/router) frontend built with Vite.

## Commands

Run from repo root (each proxies into `backend/` or `frontend/`):

```bash
npm run install:all      # install both backend and frontend deps
npm run dev:backend      # start backend (src/server.js) on :5001
npm run dev:frontend     # start frontend (Vite) on :5173
npm run build:frontend   # vite build
npm run preflight        # validate env + storage before running/deploying
npm run reset:data       # reset local file-driver data
```

Backend-only (run inside `backend/`):

```bash
npm run dev                        # node src/server.js
npm run watch                      # nodemon src/server.js
npm run health                     # ping health-check script
npm run backup:data                # dump current db to a backup file
npm run migrate:file-to-supabase   # one-time migration: file driver -> supabase (single-JSON)
npm run migrate:relational         # migrate app_state JSON -> relational Supabase tables
```

There is no automated test suite. CI (`.github/workflows/ci.yml`) only runs `npm run preflight` (backend) and `npm run build` (frontend) on push/PR to `main` — treat these as the minimum bar before considering a change done. Frontend `lint:check` is a no-op placeholder, not a real linter.

To run a single backend script directly: `node src/scripts/<name>.js` from `backend/`.

## Architecture

### Three storage drivers, one interface

Everything reads/writes through `backend/src/lib/store.js`, which exposes `readDb()` / `writeDb()` / `updateDb(mutator)` regardless of backend. `DATA_DRIVER` env var selects:

- `file` — single JSON blob at `DATA_FILE` (default `./data/db.json`), for local dev.
- `supabase` — same JSON blob, but stored as one row (`data` column) in a Supabase table (`SUPABASE_STATE_TABLE`, default `app_state`) keyed by `SUPABASE_STATE_KEY`.
- `supabase_relational` — the same logical document split across real Postgres tables (`users`, `tasks`, `task_files`, `task_comments`, `task_history`, `notifications`, `app_settings`), accessed via Postgres RPCs `get_app_state_relational` / `save_app_state_relational` (see `supabase/relational-schema.sql`). This is the recommended production driver — the legacy `app_state` row is kept as a migration source/rollback target, not deleted.

Routes and business logic never branch on the driver — they call `readDb()`/`writeDb()`/`updateDb()` and get back the same shape: `{ users, tasks, task_files, task_comments, task_history, notifications, settings }`. `updateDb(mutator)` serializes writes through an in-process promise queue (`mutationQueue`) so concurrent requests don't race on a read-modify-write of the whole document — always prefer `updateDb` over manual `readDb`+`writeDb` pairs when mutating.

For the `supabase`/`supabase_relational` drivers, reads are cached in-process for `DB_CACHE_TTL_MS` (default 30s) via `getCachedDb`/`setCachedDb`; any `writeDb` refreshes the cache. The `file` driver has no cache — it reads from disk each call.

`migrateDb()` is run on every read and write. It's an additive, idempotent schema-normalizer (fills in missing fields, renames legacy `manager` role to `bd`, etc.) — this is how the app evolves its "schema" without real migrations for the JSON-document drivers. When adding a new field to users/tasks/etc., add its default here so old records self-heal on next access, rather than special-casing `undefined` throughout route code.

File uploads (`backend/src/utils/upload.js`) have their own independent driver switch, `FILE_STORAGE_DRIVER` (`local` disk under `UPLOAD_DIR`, or `supabase` Storage bucket `SUPABASE_STORAGE_BUCKET`) — this is orthogonal to `DATA_DRIVER`.

### Backend request flow

`backend/src/server.js` wires: helmet, compression, rate limiting, a strict CORS allowlist (`FRONTEND_ORIGIN`, comma-separated), then mounts route modules under `/api/*` (`auth`, `users`, `tasks`, `reports`, `settings`, `admin`, `notifications`). All routes except `/api/auth/login` (and health checks) go through `authenticate` (JWT bearer, `backend/src/middleware/auth.js`), which loads the user from the DB on every request and attaches `req.user` (via `publicUser()`, password hash stripped). Role gating uses `permit('admin', 'bd', ...)`.

Task visibility is centralized in `canSeeTask()` (`backend/src/utils/tasks.js`): admins see all tasks, BDs see tasks they assigned (`assigned_by`), designers see tasks assigned to them (`assigned_to`). Any new task-reading endpoint must filter through `canSeeTask`, not reimplement role checks.

Task status has a stored `status` plus a derived `computed_status` (`applyComputedStatus` in `utils/tasks.js`): a task flips to `overdue` display-only when its deadline has passed and it isn't already in a terminal/review state, without mutating the stored `status`.

### Frontend

Single-page app with no router and no external state library: `frontend/src/App.jsx` (~1800 lines) holds essentially all UI, view-switching, and state via React hooks, and is the main file you'll be editing for UI changes. `frontend/src/api.js` is the sole HTTP boundary — a thin `fetch` wrapper (`api.*` methods) that attaches the JWT from `localStorage` (`dtm_token`/`dtm_user`), auto-clears session on 401, and does short-TTL (`VITE_API_CACHE_TTL_MS`, default 10s) GET response caching + in-flight de-duplication keyed by method+path. Any mutating call clears that cache. When adding a new backend endpoint, add a matching method in `api.js` rather than calling `fetch` directly from components.

### Environment config

`backend/src/config/env.js` centralizes all env parsing and `validateEnv()` throws on missing required vars for the selected drivers (fails fast on `npm run preflight`/server boot rather than at first request). Check here before adding a new env var — add both the parse and the validation.

## Deployment notes

Recommended target: frontend on Vercel, backend on Render (Free tier viable), database on Supabase Postgres using the `supabase_relational` driver (`RELATIONAL_DATABASE_MIGRATION.md`). Render's free-tier filesystem is not persistent, so `DATA_DRIVER=file` must never be used in that deployment — see `DEPLOYMENT.md` and `SECURITY.md` for the full checklist (JWT secret strength, keeping `SUPABASE_SERVICE_ROLE_KEY` backend-only/out of Vercel, `FRONTEND_ORIGIN` restricted to the real frontend domain).
