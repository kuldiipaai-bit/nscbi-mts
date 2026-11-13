# Moving to your own server (LAN / on-prem)

The app only talks to Supabase through two values, so moving is a configuration change, not a rewrite.

## 1. Run Supabase on your server
Follow the official guide: https://supabase.com/docs/guides/self-hosting/docker

```bash
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker ~/supabase-selfhost && cd ~/supabase-selfhost
cp .env.example .env      # CHANGE every secret: POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, DASHBOARD_PASSWORD
docker compose pull && docker compose up -d
```
Set `SITE_URL` / `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` in `.env` to the address users will reach (e.g. `http://10.1.2.3:8000`) and
`ENABLE_EMAIL_SIGNUP=false`, `ENABLE_EMAIL_AUTOCONFIRM=true`.

## 2. Load the schema and the Edge Function
```bash
# from this repo, against the self-hosted Postgres (port 5432 via the pooler or the db container)
docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/0001_init.sql
# Edge Function: copy supabase/functions/admin-users into ~/supabase-selfhost/volumes/functions/admin-users/
docker compose restart functions
```
Create the first admin user in Studio (`http://<server>:8000`, user `supabase`, `DASHBOARD_PASSWORD`) exactly as in `SETUP.md` step 2.

## 3. Serve the web app
```bash
cp docker/.env.example docker/.env
#   SUPABASE_URL=http://<server>:8000     SUPABASE_ANON_KEY=<ANON_KEY from the self-hosted .env>
docker compose -f docker/docker-compose.web.yml --env-file docker/.env up -d --build
```
App is now at `http://<server>:8080`. Put it behind HTTPS (Caddy/nginx + your certificate) - **phones require HTTPS** for the
camera and for installing the PWA (except on `localhost`).

## 4. Migrate data from the cloud project (optional)
`pg_dump` the `public` schema data from the cloud project, restore into the self-hosted DB; copy the `observation-photos` bucket
files (Studio -> Storage, or the Storage S3 API). Users are in `auth.users`; recreate them or dump/restore that table.

## Backups
Schedule `pg_dump` and a copy of the storage volume nightly. Test a restore.

> The self-hosted stack's compose file changes between Supabase releases; follow the version of the official guide that matches
> the image tags you pull. This repo does not vendor it.
