# Production Checklist - Supabase Version

## Supabase

- [ ] Create Supabase project.
- [ ] Run `supabase/schema.sql` in SQL Editor.
- [ ] Copy Project URL.
- [ ] Copy backend-only Secret/service_role key.
- [ ] Do not add the Secret/service_role key to Vercel or frontend code.

## Render Backend

- [ ] Root Directory is `backend`.
- [ ] Build Command is `npm install`.
- [ ] Start Command is `npm run preflight && npm start`.
- [ ] Set `DATA_DRIVER=supabase`.
- [ ] Set `SUPABASE_URL`.
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Set `SUPABASE_STATE_TABLE=app_state`.
- [ ] Set `SUPABASE_STATE_KEY=adinn-design-task-manager`.
- [ ] Set strong `JWT_SECRET`.
- [ ] Set `FRONTEND_ORIGIN` to the final Vercel URL.
- [ ] Confirm `/api/health` returns `storage_driver: supabase`.

## Vercel Frontend

- [ ] Root Directory is `frontend`.
- [ ] Framework is Vite.
- [ ] Build Command is `npm run build`.
- [ ] Output Directory is `dist`.
- [ ] Set `VITE_API_URL` to Render backend URL.
- [ ] Redeploy after changing environment variables.

## Office setup

- [ ] Login as Admin.
- [ ] Change demo passwords.
- [ ] Create real Admin/BD/Designer users.
- [ ] Assign verticals to designers.
- [ ] Create one test task and complete the workflow.
- [ ] Restart/redeploy Render and confirm users/tasks still exist.

## Backup

- [ ] Download backup from Admin Settings after setup.
- [ ] Store backups in company Google Drive or internal storage.

## Future file storage upgrade

- [ ] Move uploaded files to Supabase Storage if permanent proof/file storage is required.


## Permanent design/file storage
To store uploaded design files permanently in Supabase Storage, add these Render backend environment variables:

```text
FILE_STORAGE_DRIVER=supabase
SUPABASE_STORAGE_BUCKET=adinn-design-files
```

The backend uses the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to upload task attachments into Supabase Storage. The app can auto-create the bucket during preflight when the service role key has permission. Existing task/user data in `app_state` is not reset by this update.
