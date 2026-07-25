# دليل المدينة الخفية — Hidden Madinah: state of play

Snapshot taken **2026-07-25**, immediately after the first production deploy.
Read the "Do these first" section before writing any code — the ordering there
matters, and getting it wrong silently breaks the live site.

---

## Where everything lives

| Thing | Where |
| --- | --- |
| Live site | <https://hidden-madinah.vercel.app> |
| Vercel project | `eslamnovas-projects/hidden-madinah` (CLI account `alienowl`) |
| Git repo | <https://github.com/eslamNova/hidden-madinah> (private, branch `master`) |
| Local code | `C:\Users\IVGeekom\Desktop\2026\Islam\hidden-madinah` |
| Supabase project | ref `eoicocqjjxskbmctirrb`, region `eu-central-1`, **free tier** |
| Original photos | `C:\Users\IVGeekom\Desktop\2026\Islam\نحو المدينة\مسجد قباء\` (18 JPGs) |
| Market research | `C:\Users\IVGeekom\Desktop\2026\Islam\نحو المدينة\research.md` |

---

## Do these first (blockers, in this exact order)

### 1. Create the owner account — `/admin` is currently unusable

There are **zero** rows in `auth.users` and **zero** in `admin_users`. The admin
area is fully built and correctly gated, but nobody can log in. `create-owner.ts`
was never run because it needs the service key (see step 2).

### 2. Paste `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`

Supabase Dashboard → Project Settings → API keys → `service_role`. It is
**only** used by local scripts, and must never be added to Vercel.

Then, in order:

```bash
# creates the auth user + admin_users row; you choose the password
npx tsx scripts/create-owner.ts --password "<pick-a-strong-one>"

# uploads the 18 Quba photos to Supabase Storage properly
npx tsx scripts/import-media.ts --dir "C:\Users\IVGeekom\Desktop\2026\Islam\نحو المدينة\مسجد قباء" --slug masjid-quba
```

Then delete the 18 temporary local-path rows (they are the ones whose `url`
starts with `/media/`, as opposed to the new Storage URLs):

```sql
delete from media where url like '/media/%';
```

Finally redeploy: `npx vercel --prod`.

### 3. Only *after* step 2 — connect GitHub for auto-deploys

**Why the order matters.** `public/media/` is git-ignored, so the photos are not
in the repo. The Vercel **CLI** uploads the whole working directory, so it swept
them up — that is the only reason images work on the live site today. A
**git-triggered** deploy has no such folder, so every photo would 404 and the
gallery would fall back to placeholder tiles.

To connect: Vercel dashboard → Project → Settings → Git → Connect, or install the
Vercel GitHub App on `eslamNova/hidden-madinah`. (`vercel git connect` from the
CLI fails until the app can see the private repo.)

---

## What is built and working

Verified live on production, not just locally.

- **Public pages** — home (photo hero, featured, category tiles, nearest-by-geolocation, routes), `/places` (Arabic search + category/distance/best-time filters), `/places/[slug]` (SSG, photo hero, quote callout, visit-info card, gallery, story, virtue, tips, map, related places), `/map` (full-screen, category pins, bottom sheet), `/routes` + `/routes/[id]` (ordered stops, connecting line, total distance).
- **Admin CMS** at `/admin` — auth gate, place editor covering every Content Pack field, transport-options editor, draggable map pin with Haversine auto-distance, client-side media upload (EXIF read for pin pre-fill, then canvas resize which strips EXIF), ▲/▼ media reorder, publish toggle, "يحتاج مراجعة" badges. Built and gated, but unusable until step 1 above.
- **PWA** — installable, Serwist service worker, `/~offline` fallback precached, runtime caching for pages, Supabase images, and map tiles/glyphs.
- **Accessibility** — elderly-first throughout: 18px base with an in-app أ−/أ+ control (18/20/23px, persisted, no flash), zoom never disabled, ≥48px touch targets, labelled 4-item bottom nav, visible form labels, `prefers-reduced-motion` respected.
- **SEO** — per-place Arabic titles/descriptions, photo-based OG images, sitemap, robots. Canonical origin resolves from `VERCEL_PROJECT_PRODUCTION_URL`.

---

## Content status

13 places (8 published, 3 featured), 18 photos, 1 route with 3 stops.

| Slug | Name | Category | Published | Photos | km |
| --- | --- | --- | --- | --- | --- |
| `masjid-quba` | مسجد قباء | mosque | ✅ featured | **18** | 3.5 |
| `bir-uthman` | بئر عثمان (بئر رومة) | well | ✅ featured | 0 | 4.7 |
| `jabal-sala` | جبل سلع | historical_site | ✅ featured | 0 | 0.8 |
| `masjid-bani-haram` | مسجد بني حرام | mosque | ✅ | 0 | 1.4 |
| `bir-ghars` | بئر غرس | well | ✅ | 0 | 2.3 |
| `basatin-quba` | بساتين قباء | garden | ✅ | 0 | 3.5 |
| `basatin-al-awali` | بساتين العوالي | garden | ✅ | 0 | 3.7 |
| `hijaz-railway-station` | محطة سكة حديد الحجاز | historical_site | ✅ | 0 | 1.1 |
| `bir-al-khatam-aris` | بئر الخاتم (بئر أريس) | well | draft | 0 | — |
| `bustan-al-mustazal` | بستان المستظل | garden | draft | 0 | — |
| `masjid-bani-anif` | مسجد بني أنيف | mosque | draft | 0 | — |
| `masjid-al-jumuah` | مسجد الجمعة | mosque | draft | 0 | — |
| `buyut-al-sahaba-quba` | مواقع بيوت الصحابة | historical_site | draft | 0 | — |

Only **مسجد قباء** carries the owner's real content and photos. The other seven
published entries are realistic Arabic placeholders written during the build —
**they need the owner's review before this site is promoted anywhere.** The five
drafts are the Content Pack stubs, unpublished and awaiting the owner's info.

### Facts still needing the owner's confirmation

Four places carry inline `[VERIFY: …]` markers and eight carry `admin_notes_ar`.
Both drive the "يحتاج مراجعة" badge in `/admin`. Public pages strip the markers
and hide any field that becomes empty, so visitors never see unconfirmed text.

Specifically for مسجد قباء:

1. **Coordinates conflict.** The seeded pin is `24.4394, 39.6172` (the widely
   known Quba Mosque location, consistent with the owner's "10 minutes by car").
   The owner's shared Google Maps short link resolves to `24.3992514, 39.6440995`
   — about **5.3 km away**, and ~8 km from the Haram, which contradicts the stated
   drive time. Probably a mis-tagged POI. The owner should confirm via the admin pin.
2. **Distance 3.5 km** is the owner's road estimate; Haversine gives ~3.2 km
   straight-line. Owner values are never overwritten automatically.
3. **The hadith wording and attribution** in `virtue_ar` were added from general
   knowledge, *not* from the owner's text. The owner (a specialist) should verify.
4. **`best_time_ar` and `open_status_ar`** are still placeholders and therefore
   render as nothing on the public page.
5. **Taxi prices** (10–15 SAR regular, 20–25 SAR ride-hailing) are the owner's
   estimates as of 2026-07-24; the page shows `last_updated`.

Also worth knowing: **none of the 18 photos had GPS EXIF data**, confirming that
Google Photos strips location on shared-album downloads. Pins must be placed by
hand in the admin.

---

## Architecture decisions worth not undoing

| Decision | Why |
| --- | --- |
| **maplibre-gl pinned to `^5`** | `^5` resolved to 6.0.0, an ESM-only major whose separate worker module the dev server returned as HTML — the map rendered as a blank white box. v5 inlines the worker. **Do not bump to v6 casually.** |
| **No `next/image`; plain `<img>` with explicit srcset** | Only three variants exist (400/800/1600). A custom loader could not express that and made cards pull the 1600px file (176 kB) on high-DPR phones; they now take the 800px one (51 kB). |
| **`NEXT_PUBLIC_SITE_URL` unset on Vercel** | `siteUrl()` in `src/lib/constants.ts` falls back to `VERCEL_PROJECT_PRODUCTION_URL`. Set it only for a custom domain — `.env.local` holds `localhost:3000`, which would poison canonical URLs if copied to Vercel. |
| **`PublicPlaceView` DTO** | Passing raw DB rows to components leaked `[VERIFY]` text and `admin_notes_ar` into the page payload (invisible on screen, readable in source). Everything public now renders from the sanitized view. Keep it that way. |
| **`/~offline` in `additionalPrecacheEntries`** | Serwist's fallback plugin serves from the precache; without this the offline page failed exactly when needed. |
| **Admin i18n namespace stripped from the root layout** | Otherwise every public page shipped the admin strings in its payload. |
| **MapLibre + OpenFreeMap, self-hosted RTL plugin** | No token, no cost. `@mapbox/mapbox-gl-rtl-text` is pinned at **0.2.3** and served from `public/` — 0.3.0 is broken with MapLibre, and a CDN copy would break offline. Without it Arabic labels render as disconnected glyphs. |

---

## Local development

```bash
cd C:\Users\IVGeekom\Desktop\2026\Islam\hidden-madinah
npm run dev          # http://localhost:3000
```

Two Windows gotchas that cost real time during the build:

- **Orphaned servers keep port 3000.** If the browser shows stale content, check
  `netstat -ano | findstr :3000` — a leftover `next start` will hold the port and
  the new dev server silently moves to 3001 while you keep looking at the old one.
- **`EPERM: … .next\trace`** on start means a previous Node process still holds the
  folder. Kill stray `node.exe` processes for this project, then `rm -rf .next`.

Quality gates (both currently clean):

```bash
npx tsc --noEmit
npx eslint src scripts --max-warnings=0
npm run build
```

**Supabase free tier pauses the project after ~1 week of inactivity.** If the site
starts erroring for no reason, restore it from the Supabase dashboard.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `scripts/create-owner.ts` | Creates the owner auth user + `admin_users` row. Needs the service key. |
| `scripts/import-media.ts` | The real pipeline: EXIF → sharp variants → Supabase Storage → `media` rows. Idempotent (keyed on URL); re-running yields 0 new rows. Needs the service key. |
| `scripts/import-media-local.ts` | **Temporary bridge.** Same processing, but writes to `public/media/` and emits SQL. Delete this script and the folder once step 2 is done. |
| `scripts/generate-icons.ts` | PWA icons. |

Video compression (documented in `README.md`):

```bash
ffmpeg -i in.mp4 -vf "scale=-2:720" -c:v libx264 -crf 23 -preset medium \
  -movflags +faststart -c:a aac -b:a 128k out.mp4
```

---

## Loose ends I did not close

- **The adversarial code review never finished.** It raised 15 candidate findings
  across correctness, security/privacy, and accessibility, then died on a session
  limit before verifying any of them, so none are confirmed and none were acted on.
  Re-running a review pass is worthwhile. The two issues I *did* find and fix by
  hand were the `[VERIFY]`/admin-notes payload leak and the un-precached offline page.
- **No automated tests exist.** Everything so far has been verified by building,
  typechecking, linting, and hitting real URLs.
- **Nothing has been checked in a real browser at mobile width.** Layout, the
  pinch-zoom gallery, and the admin flow on a phone are unverified visually.
- **Lighthouse has not been run** against production.
- **The first CLI deploy failed** with an opaque Vercel platform error
  (`Internal Server Error` where JSON was expected) partway through the upload; an
  unchanged retry succeeded. Appears transient — if it recurs, it is Vercel's side.

---

## Suggested next moves

1. Steps 1–3 above (owner account, photos to Storage, then GitHub auto-deploy).
2. Owner reviews the seven placeholder places and resolves the Quba `[VERIFY]` items.
3. Photograph the five draft Quba-area places, then publish them — that turns the
   "أماكن خفية قريبة" section on the Quba page live, which is the app's whole thesis.
4. Run a proper review pass and a mobile-browser check before promoting the site.
5. Grow toward the 30–50 places that `research.md` identifies as the launch threshold.