# Setup: free cloud deployment (GitHub Pages + Supabase)

Total cost: Rs 0 on the free tiers. Check each provider's current free limits before going live.

## 1. Create the Supabase project
1. Sign up at supabase.com, create a project (pick the nearest region, e.g. Mumbai).
2. **Authentication -> Providers -> Email**: turn **off** "Allow new users to sign up" (accounts are created by the Admin only) and turn **off** "Confirm email".
3. **SQL Editor**: paste and run, in this order, `supabase/migrations/0001_init.sql`, `0002_harden_function_grants.sql`, `0003_inactive_self_signup.sql`. (Do NOT run `seed.sql` in production.)
4. **Settings -> API**: note the *Project URL* and the *anon public* key.

## 2. Create the first Admin
The first user created in the project, if its email is exactly `admin@mts.local`, automatically becomes **admin**. Anyone who registers without an admin-assigned role starts inactive and sees nothing.
1. **Authentication -> Users -> Add user**: email `admin@mts.local`, a strong password, tick "Auto Confirm".
2. Login ID in the app is the part before `@mts.local` -> `admin`.
3. Sign in, open **Users** and create the GM, Maintenance Engineers and Shift Engineers (each gets a login ID + temporary password). Then **Services** -> add services and assign each to its Maintenance Engineer.

## 3. Deploy the admin Edge Function (needed for Users screen)
With the Supabase CLI (`npm i -g supabase`):
```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy admin-users
```
(Or paste `supabase/functions/admin-users/index.ts` in **Edge Functions -> New function** named `admin-users`.)

## 4. GitHub
1. Create an empty **public** repository on GitHub (free Pages needs a public repo). Push this project to its `main` branch.
2. Put the Supabase **Project URL** and **anon public** key in `web/.env.production` (copy `web/.env.production.example`) and commit it.
   Both values are public by design (every visitor's browser receives them); Row Level Security in the database protects the data.
   Never put the service-role key or the database password anywhere in the repo.
3. **Settings -> Pages -> Source: GitHub Actions**.
4. Push to `main` -> the *Deploy to GitHub Pages* workflow publishes `https://<user>.github.io/<repo>/`.
5. Do not run `supabase/seed.sql` on the cloud project: it contains demo users with a published password.

The *Supabase keep-alive* workflow pings the database twice a week so the free project is not paused.

## 5. Install on phones
Open the site in Chrome/Safari -> "Add to Home Screen". It runs full-screen like an app.

## Local development
```bash
cd web
cp .env.example .env.local     # fill in your Supabase URL + anon key
npm install
npm run dev
```
For a fully local backend run Supabase locally (`supabase start`, needs Docker) and apply `supabase/seed.sql` for demo users
(`admin1`, `me_elec`, `me_hvac`, `se1`, `se2`, `gm1`, password in the seed file).

## Free-tier limits and habits
- Database ~500 MB, file storage ~1 GB. Photos are compressed to roughly 150-300 KB in the browser; max 4 per observation.
- Roughly 1 GB covers several thousand photos. Delete very old observations or move to self-hosting / a paid plan when needed.
- Operational airport data is stored on a third-party cloud: confirm this is acceptable under your organisation's IT/security policy. If not, use `docs/SELFHOST.md`.
