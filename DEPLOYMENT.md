# Deployment Guide - Supabase Database Version

This version stores users, tasks, settings, comments, and timeline data in Supabase PostgreSQL through a secure backend API. This avoids data loss on Render Free restarts.

## 1. Create Supabase project

1. Open Supabase and create a new project.
2. Go to SQL Editor.
3. Open `supabase/schema.sql` from this project.
4. Paste it into SQL Editor and run it once.

The SQL creates `public.app_state` with a `jsonb` data column. The backend stores the full application state in this table.

## 2. Get Supabase backend credentials

From your Supabase project:

- Copy the Project URL.
- Copy a server-side secret key. In older projects this may be called `service_role`; in newer projects use a Secret key.

Important: never put the service role or secret key in Vercel/frontend. It must be stored only in Render backend environment variables.

## 3. Render backend settings

Use these settings:

```text
Root Directory: backend
Runtime: Node
Instance Type: Free
Build Command: npm install
Start Command: npm run preflight && npm start
Health Check Path: /api/health
```

Add these environment variables in Render:

```text
NODE_ENV=production
TRUST_PROXY=true
DATA_DRIVER=supabase
SUPABASE_URL=<your Supabase Project URL>
SUPABASE_SERVICE_ROLE_KEY=<your Supabase Secret/service_role key>
SUPABASE_STATE_TABLE=app_state
SUPABASE_STATE_KEY=adinn-design-task-manager
UPLOAD_DIR=./uploads
BACKUP_DIR=./data/backups
JWT_SECRET=<strong generated secret>
JWT_EXPIRES_IN=7d
FRONTEND_ORIGIN=<your Vercel frontend URL>
```

Generate JWT secret locally:

```bash
cd backend
node src/scripts/generateSecret.js
```

After deploy, test:

```text
https://your-render-backend.onrender.com/api/health
```

Expected result includes:

```json
{
  "ok": true,
  "storage_driver": "supabase"
}
```

## 4. Vercel frontend settings

Use these settings:

```text
Root Directory: frontend
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Add this environment variable in Vercel:

```text
VITE_API_URL=https://your-render-backend.onrender.com
```

Redeploy frontend after adding or changing `VITE_API_URL`.

## 5. Update backend CORS

After Vercel gives the final frontend URL, update Render:

```text
FRONTEND_ORIGIN=https://your-vercel-frontend-url.vercel.app
```

Then redeploy the Render backend.

## 6. Smoke test

1. Open Vercel frontend.
2. Login as Admin.
3. Create one test designer.
4. Refresh the app and confirm the user remains.
5. Restart/redeploy Render and confirm the user still remains.
6. Check Admin Settings -> System. Storage driver should show `supabase`.

## 7. Existing local JSON migration

If you have important local `backend/data/db.json` data, use:

```bash
cd backend
DATA_DRIVER=supabase \
SUPABASE_URL=<your Supabase Project URL> \
SUPABASE_SERVICE_ROLE_KEY=<your Supabase Secret/service_role key> \
node src/scripts/migrateFileToSupabase.js ./data/db.json
```

## Important note about uploads

This update makes users, tasks, comments, task history, settings, and reports persistent in Supabase. Uploaded physical files are still stored in Render local storage on the free instance and may not be permanent after restarts. For permanent file uploads, the next upgrade should move uploads to Supabase Storage.

## Updating an existing Supabase deployment without losing data

This update does not require deleting or recreating Supabase tables. Keep the existing `app_state` table and existing Render environment variables.

Steps:

1. Replace the local project with this updated ZIP.
2. Push the updated code to GitHub.
3. Redeploy Render backend.
4. Let Vercel redeploy the frontend.
5. Login and verify existing users/tasks are still visible.

The backend migration adds missing task fields automatically to existing records:

- assignment_date
- zoho_project_no
- vertical
- started_working_date
- started_working_time
- end_time
- status_of_day

Do not run any reset script in production.


## Permanent design/file storage
To store uploaded design files permanently in Supabase Storage, add these Render backend environment variables:

```text
FILE_STORAGE_DRIVER=supabase
SUPABASE_STORAGE_BUCKET=adinn-design-files
```

The backend uses the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to upload task attachments into Supabase Storage. The app can auto-create the bucket during preflight when the service role key has permission. Existing task/user data in `app_state` is not reset by this update.
