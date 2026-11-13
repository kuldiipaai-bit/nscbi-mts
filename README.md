# Maintenance Activity Tracking System

NSCBI Airport (AAI) terminal-building maintenance tracking. Mobile-first PWA.

**Flow:** Maintenance Engineer (ME) schedules activities with start/end time -> every Shift Engineer (SE) sees the day's activities
(highlighting what is running now), visits, ticks, remarks, photos -> goes to the owning ME and GM -> ME/GM post remarks that all SEs
see -> ME, SE or GM mark it Resolved with a closing note (ME-owner/GM can reopen).

| Role | Can do |
|---|---|
| Admin | users, services, assign services to MEs |
| Maintenance Engineer | add activities (form / Excel-CSV import / recurring) for own services; remark + resolve on own services |
| Shift Engineer | see all activities by day; record observations (tick, checklist, remarks, photos); resolve |
| GM / Dept Head | overview dashboard, all observations, remarks, resolve/reopen, CSV export |

No shift timings are configured anywhere: an activity has only a date and start/end time (end earlier than start = ends next day).

## Layout
- `web/` Next.js (static export) + Tailwind
- `supabase/migrations` schema, RLS, triggers, RPCs; `supabase/seed.sql` demo data (dev only); `supabase/functions/admin-users` Edge Function; `supabase/tests` SQL tests
- `docker/` web image (nginx) + compose; `.github/workflows` CI, Pages deploy, keep-alive
- `docs/SETUP.md` free cloud deploy; `docs/SELFHOST.md` move to your own server

## Commands
```bash
cd web && npm install && npm run dev      # dev
npm test && npm run typecheck && npm run build
```
