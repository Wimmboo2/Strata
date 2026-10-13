# Strata setup

1. Create Supabase project. Run `supabase/schema.sql` in SQL editor. Copy URL, anon key, service-role key.
2. Create GitHub App with read-only contents, pull requests, issues. Set webhook URL to `https://<render-host>/webhooks/github`. Copy App ID, private key, webhook secret.
3. Vercel: import `frontend/`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Render: create web service from `backend/`. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_WEBHOOK_SECRET`, `SYNC_CRON_SECRET`. Create cron `npm run sync` every 30 min.
5. Register user via `/register` with email, password, GitHub profile URL. Create project, add public `owner/repo` names, install App where instant updates needed.
