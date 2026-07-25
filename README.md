# دليل المدينة الخفية — Hidden Madinah

An Arabic-first, RTL, installable web app (PWA) that guides visitors to the lesser-known heritage sites of Madinah — mosques, wells, farms, and forts beyond the famous landmarks. Every place page tells the story, the virtue, and the practical details (how to get there, cost, best time to visit) in calm, elderly-friendly Arabic, with photos and an interactive map. Content is managed by the owner through a private admin area.

**Stack:** Next.js 15 (App Router) + TypeScript · Supabase (Postgres, Auth, Storage) · MapLibre GL with OpenFreeMap tiles · Serwist PWA (offline support) · Tailwind CSS v4 (RTL, logical properties) · next-intl.

---

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

### `.env.local` variables

| Variable | Required | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public (anon) API key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (scripts/admin server) | **The one manual step:** copy it from the Supabase Dashboard → **Project Settings → API keys** (the `service_role` key) and paste it here. Never commit it or expose it to the browser. |
| `REVALIDATE_SECRET` | optional | Shared secret for `POST /api/revalidate`; lets the import script refresh pages after uploading photos |
| `NEXT_PUBLIC_SITE_URL` | yes | Public site URL (use `http://localhost:3000` in development) |

The scripts (below) fail fast with a clear message if `SUPABASE_SERVICE_ROLE_KEY` is empty.

---

## Supabase

- **Project ref:** `eoicocqjjxskbmctirrb` (region `eu-central-1`, **free tier**).
- **Migrations** live in `supabase/migrations/` (already applied to the live project).
- **Seed** lives in `supabase/seed.sql` — it is idempotent; you can re-run it safely in the Dashboard SQL editor.

### Free-tier notes (important)

- **No on-the-fly image transformations** on the free tier — that is why the media pipeline pre-generates fixed variants (400 / 800 / 1600 WebP + a 1600 JPEG fallback) at import time.
- **1 GB** total storage, **50 MB** max per file.
- The project **pauses after about one week of inactivity**. If the site suddenly cannot reach the database, open the Supabase Dashboard and click **Restore project** (or ask Claude to restore it via MCP). Data is not lost by pausing.

---

## Owner setup (one time)

1. Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local` (see above).
2. Create the owner account and grant admin access:

   ```bash
   npx tsx scripts/create-owner.ts --email you@example.com --password "a-strong-password"
   ```

   The email defaults to `OWNER_EMAIL` from `.env.local` (or the project owner's address); the password can also come from `OWNER_PASSWORD`. The script is idempotent — re-running it never duplicates the user, and it never changes an existing password.
3. Sign in at **`/admin/login`**.

---

## Media pipeline (photos)

**The Google Photos album is the SOURCE only — never hotlink its URLs.** Links like `photos.app.goo.gl/…` or `lh3.googleusercontent.com/…` expire and rotate, and the Google Photos Library API stopped serving user albums on 2025‑03‑31. Photos must be downloaded and re-hosted in Supabase Storage.

Workflow:

1. **Download the originals** from the album: album **⋮ → Download all** (or Google Takeout for a full export). Unzip into a folder — Arabic folder names are fine.
2. **Run the import script** (example with the real Quba folder):

   ```bash
   npx tsx scripts/import-media.ts --dir "C:\Users\IVGeekom\Desktop\2026\Islam\نحو المدينة\مسجد قباء" --slug masjid-quba
   ```

   Add `--dry-run` to preview (EXIF + variant sizes) without uploading or touching the database.
3. What the script does per photo:
   - reads EXIF **before** processing (capture date for gallery order, GPS if present),
   - generates 400 / 800 / 1600 WebP variants + a 1600 JPEG fallback (for OpenGraph),
   - uploads them to the `media` bucket and upserts one `media` row (re-running adds **0** new rows),
   - **EXIF GPS auto-suggests the map pin:** if the place has no coordinates yet, the median photo GPS sets `lat`/`lng` and the distance from the Prophet's Mosque; if the place already has coordinates, the script only prints a comparison and never overwrites,
   - **all EXIF (including GPS) is stripped from the published files** — only the database keeps the pin.
4. If `REVALIDATE_SECRET` is set and the dev/production server is running, the script asks the app to refresh the home, places, place, and map pages.

Note: many Google Photos downloads have GPS stripped — that is normal; set the pin manually in the admin instead.

## Video

Compress before uploading — phones record far larger files than the web needs:

```bash
ffmpeg -i in.mp4 -vf "scale=-2:720" -c:v libx264 -crf 23 -preset medium -movflags +faststart -c:a aac -b:a 128k out.mp4
```

Poster frame:

```bash
ffmpeg -i out.mp4 -ss 1 -frames:v 1 poster.jpg
```

Keep clips **≤ ~90 seconds and ≤ 50 MB** for Supabase Storage. For anything longer, use **Bunny Stream** or an **unlisted YouTube** video — the `media.provider` column supports `bunny` and `youtube`.

---

## Content review workflow

- While writing, the owner can leave **`[VERIFY: …]`** markers inside any content field (e.g. "best time to visit [VERIFY: confirm opening hours]"). These markers are **automatically hidden from visitors** — if a field contains only a marker, the whole row disappears from the public page.
- Places with markers surface in **/admin** with a **"يحتاج مراجعة"** (needs review) badge listing the flagged fields.
- `admin_notes_ar` holds private review notes that never appear publicly (Quba currently carries a coordinates-confirmation note).

---

## PWA / offline

The app is installable (Add to Home Screen) and works offline via a Serwist service worker: the app shell, map tiles seen before, and visited place pages are cached; an offline banner appears when the connection drops, and unvisited pages fall back to a friendly offline screen.

To test offline behavior (service worker runs in production builds only):

```bash
npm run build
npm run start
```

Then open the site, browse a few pages, and in DevTools → **Network** set throttling to **Offline** and reload.

---

## Deployment (Vercel)

Live: <https://hidden-madinah.vercel.app> — Vercel project `eslamnovas-projects/hidden-madinah`,
repo <https://github.com/eslamNova/hidden-madinah> (private).

Environment variables set on Vercel (Production + Preview):

| Variable | Why |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | needed at build time for SSG and at runtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same |
| `REVALIDATE_SECRET` | guards `POST /api/revalidate` |

`NEXT_PUBLIC_SITE_URL` is deliberately **not** set on Vercel: `siteUrl()` in
`src/lib/constants.ts` falls back to `VERCEL_PROJECT_PRODUCTION_URL`, so canonical
URLs, OG images, sitemap and robots track the deployment automatically. Set it only
when a custom domain is attached. `SUPABASE_SERVICE_ROLE_KEY` is **not** needed on
Vercel — it is only used by the local scripts.

Deploy manually with:

```bash
npx vercel --prod
```

### Two things to finish

1. **Connect the GitHub repo for auto-deploys.** `vercel git connect` fails until
   Vercel's GitHub App can see the private repo. Grant it in the Vercel dashboard
   (Project → Settings → Git → Connect), or install/configure the Vercel GitHub App
   on `eslamNova/hidden-madinah`, then pushes to `master` deploy on their own.

2. **Move the photos into Supabase Storage.** `public/media/` is git-ignored, so it
   is absent from the repo. The CLI (`vercel --prod`) uploads the working directory
   and therefore *does* include it — which is why images work on the current
   deployment. A **git-triggered** deploy will not include it and the images will
   404. Fix by pasting `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`, running
   `npx tsx scripts/import-media.ts --dir "<folder>" --slug masjid-quba`, deleting
   the old local-path rows, and redeploying.

## Scripts reference

Run all scripts from the repo root with `npx tsx`:

| Script | Command | Purpose |
|---|---|---|
| Import photos | `npx tsx scripts/import-media.ts --dir "<folder>" --slug <place-slug> [--dry-run]` | Resize/convert, upload to Storage, create `media` rows, suggest the map pin from EXIF GPS |
| Create owner | `npx tsx scripts/create-owner.ts --email <email> --password <password>` | Create the owner auth user (idempotent) and grant admin access |
| Generate icons | `npx tsx scripts/generate-icons.ts` | Regenerate the PWA icons in `public/icons/` |
