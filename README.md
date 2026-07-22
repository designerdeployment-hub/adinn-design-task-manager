# Adinn Design Work Allocation

Professional internal web application for Adinn design task allocation, BD workflow tracking, designer vertical assignment, task acceptance/decline, status tracking, reports, and admin management.

## Key features

- Admin, Business Developer (BD), and Designer roles
- Designer vertical assignment
- Designer filtering by vertical
- BD workload board with timings and active task load
- Task assignment, acceptance, decline with reason
- Status tracker and task timeline
- Comments and file uploads
- Reports and CSV export
- Admin settings for categories, priorities, and verticals
- Admin user delete option
- Admin-only task delete option
- Supabase database support for persistent users/tasks on Render Free

## Storage

This release supports two storage drivers:

```text
DATA_DRIVER=file       Local JSON file for development
DATA_DRIVER=supabase   Supabase PostgreSQL for deployment
```

For Render Free deployment, use Supabase. Render Free local filesystem is not reliable for permanent users/tasks.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Add Supabase credentials to Render backend environment variables:

```text
DATA_DRIVER=supabase
SUPABASE_URL=<your Supabase Project URL>
SUPABASE_SERVICE_ROLE_KEY=<your backend-only Secret/service_role key>
SUPABASE_STATE_TABLE=app_state
SUPABASE_STATE_KEY=adinn-design-task-manager
```

Never add the Supabase service role / secret key to Vercel or frontend code.

## Local development

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run preflight
npm run dev
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Deployment

Read `DEPLOYMENT.md`.

Recommended deployment:

```text
Frontend: Vercel
Backend: Render Free
Database: Supabase PostgreSQL
```

## Initial demo login

```text
Admin: admin@adinn.com / admin123
BD: bd@adinn.com / bd123
Designer: designer@adinn.com / designer123
```

Change demo passwords immediately after deployment.

## Latest workflow update: Essential task fields and reports

This release keeps the existing Supabase `app_state` data structure and adds new fields through automatic backend migration. Existing users, tasks, comments, history, and settings are preserved.

New task fields added:

- Date of Assignment
- TASK
- Zoho Project No.
- Designers
- Vertical
- Priority
- Deadline
- Started Working Dt/Time
- End Time
- Status of the Day
- Attachments

Reports now support:

- Weekly report
- Monthly report
- Yearly report
- Project-wise filtering using Zoho Project No. / project text
- Date-wise filtering by assignment date, deadline date, started working date, or completed date
- CSV export using the same filters

Deployment note: no new Supabase SQL migration is required because the app stores workflow state in the existing `app_state` table. Deploying the updated backend will auto-migrate the JSON safely on first read/write.


## Permanent design/file storage
To store uploaded design files permanently in Supabase Storage, add these Render backend environment variables:

```text
FILE_STORAGE_DRIVER=supabase
SUPABASE_STORAGE_BUCKET=adinn-design-files
```

The backend uses the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to upload task attachments into Supabase Storage. The app can auto-create the bucket during preflight when the service role key has permission. Existing task/user data in `app_state` is not reset by this update.
