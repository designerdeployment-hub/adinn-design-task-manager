# Security Notes

This is an internal business workflow application.

## Required production security

- Keep the GitHub repository private.
- Never commit `.env` files.
- Use a strong production `JWT_SECRET`.
- Replace demo passwords immediately.
- Restrict admin access to trusted users only.
- Keep `SUPABASE_SERVICE_ROLE_KEY` or Supabase Secret key only in Render backend environment variables.
- Never put Supabase service role / secret keys in Vercel, frontend `.env`, browser code, screenshots, or chats.
- Set `FRONTEND_ORIGIN` to the final Vercel domain only.
- Download backups regularly from Admin Settings.

## Data storage

Users, tasks, comments, history, and settings are stored in Supabase PostgreSQL using the `app_state` table.

Uploaded physical files are still local to the backend runtime in this version. For permanent uploads, use Supabase Storage in the next upgrade.
