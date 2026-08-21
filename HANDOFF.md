# دليل المدينة الخفية — Hidden Madinah: state of play

Snapshot taken **2026-08-03**, after the second production deploy: owner content
for three places, all media moved to Supabase Storage, video support in the
import pipeline, and the new cinematic story landing page.

Previous snapshot: 2026-07-25 (first deploy). Of its three blockers, **step 2
(service key + media to Storage) is fully done**, step 1 (owner account) is
still open, and step 3 (GitHub auto-deploy) is now safe to do — see below.

---

## Where everything lives

| Thing | Where |
| --- | --- |
| Live site | <https://hidden-madinah.vercel.app> |
| Vercel project | `eslamnovas-projects/hidden-madinah` (CLI account `alienowl`) |
| Git repo | <https://github.com/eslamNova/hidden-madinah> (private, branch `master`) |
| Local code | `C:\Users\IVGeekom\Desktop\2026\Islam\hidden-madinah` |
| Supabase project | ref `eoicocqjjxskbmctirrb`, region `eu-central-1`, **free tier** |
| Owner source material | `my_data/` (git- and vercel-ignored) + `C:\Users\IVGeekom\Desktop\2026\Islam\نحو المدينة\` |

`SUPABASE_SERVICE_ROLE_KEY` **is now present in `.env.local`** (local scripts
only — never add it to Vercel). Historical gotcha: the first key pasted was the
*anon* key, which fails storage uploads with "violates row-level security". To
check which key you have without printing it, decode the JWT's `role` claim —
it must say `service_role`.

---

## What happened on 2026-08-03

1. **Owner delivered real content for 3 places** (dropped in `my_data/`:
   `info.txt` + a photo/video zip per place):
   - **المساجد السبعة** `al-masajid-al-sabaa` — brand new row, published.
     Coordinates from the owner's Google Maps link (24.476696, 39.5962394);
     distance 1.8 km is straight-line Haversine (owner only gave drive time).
     Cross-linked with `jabal-sala` in both directions.
   - **مسجد بني أنيف** `masjid-bani-anif` — draft stub filled with owner
     content and published. Pin from the owner's maps link (24.4356837, 39.6154518).
   - **بئر غرس** `bir-ghars` — placeholder text fully replaced with owner
     content (hadiths from سنن ابن ماجه, the غُسل story, 4 PM–midnight hours).
     **Pin still needs confirming**: the owner's short link resolves to a JS-only
     page, so the seeded coordinates (24.4497, 39.6233) were kept — plausible
     (matches "1.5 km from Quba, in Qurban") but unverified. Flagged in
     `admin_notes_ar`.
2. **All media moved to Supabase Storage** — 45 rows, zero missing thumbs:
   quba 18 photos, السبعة مساجد 10 photos + 3 videos, أنيف 5 + 2, غرس 5 + 2.
   The temporary `/media/%` rows were deleted; `public/media/` and
   `scripts/import-media-local.ts` (the local bridge) were **deleted** per the
   old handoff's instruction. Nothing depends on locally-served media anymore.
3. **`scripts/import-media.ts` now imports videos** (see Scripts below).
4. **Story landing panels prefer photo-rich places** (`src/app/page.tsx`):
   featured-with-photos first, then any published place with photos, and
   photo-less featured places only as placeholder-art fallback. جبل سلع /
   بئر عثمان automatically reclaim their panels the day they get photos.
5. **Deployed to production** (CLI deploy, run by the owner) and verified live:
   the story landing shows the three new places with Storage imagery, and
   `/places/al-masajid-al-sabaa` renders photos + 3 video players.

The cinematic landing itself (`src/components/home/StoryLanding.tsx` /
`StoryPanel.tsx`, plus header/nav/i18n edits) was built by the owner in a
separate session and shipped in this deploy.

---

## Content status

14 places, **10 published**, 3 featured (unchanged: قباء، بئر عثمان، جبل سلع).

Places with real owner content: **مسجد قباء، المساجد السبعة، مسجد بني أنيف، بئر غرس**
(the last three added 2026-08-03). Media: only these four have any.

Still carrying **placeholder content written during the build** (needs owner
review before promotion): بئر عثمان، جبل سلع، مسجد بني حرام، بساتين قباء،
بساتين العوالي، محطة سكة حديد الحجاز.

Remaining **drafts** (Content Pack stubs, unpublished): بئر الخاتم (أريس)،
بستان المستظل، مسجد الجمعة، مواقع بيوت الصحابة.

Open verification items: the Quba `[VERIFY]` markers from the previous handoff
(coordinates conflict, hadith attribution, best-time/open-status placeholders)
are all still open, plus the بئر غرس pin above. `admin_notes_ar` on the three
new places records provenance ("المحتوى من مادة المالك 2026-08-03").

---

## Deployment — read before deploying

- **`.vercelignore` now exists and matters.** The Vercel CLI does *not*
  respect `.gitignore`; before this file existed, a deploy tried to upload
  **696 MB** because `my_data/` (902 MB of owner originals) was swept up. It
  excludes `my_data`, `public/media`, `.next`, `.env*`.
- **GitHub auto-deploy is now SAFE to connect.** The old warning (git deploys
  would 404 every image because `public/media/` was git-ignored) is obsolete —
  all media is in Supabase Storage. Connecting the Vercel GitHub App to
  `eslamNova/hidden-madinah` is now purely an improvement.
- Until that's connected, deploy with `npx vercel --prod` from the repo root.
- Content edits in the DB do **not** appear on the live site by themselves —
  pages are SSG with `revalidate = 86400` (24 h). Redeploy (or wait a day).

---

## Scripts

All Supabase scripts need the service key in `.env.local` **and, on Node 20,
the WebSocket flag** (supabase-js requires it; Node 22+ won't):

```bash
NODE_OPTIONS=--experimental-websocket npx tsx scripts/import-media.ts --dir "<folder>" --slug <slug> [--dry-run]
```

| Script | Purpose |
| --- | --- |
| `scripts/import-media.ts` | Photos **and videos**. Photos: EXIF → 400/800/1600 WebP + 1600 JPEG → Storage → `media` row. Videos (`.mp4`, needs ffmpeg+ffprobe on PATH): probe → re-encode 720p H.264 (rotation-aware short-side cap, crf 23, faststart, **metadata/GPS stripped**) → ≤800px poster JPEG → `type='video'` row with `duration_seconds`. Errors per-file if compressed output exceeds the bucket's 50 MB limit. Idempotent (keyed on URL ← sha1 of the original file). Storage paths shared with the admin uploader via `src/lib/media-spec.ts` (`videoObjectPath` / `videoPosterPath`). |
| `scripts/create-owner.ts` | Creates the owner auth user + `admin_users` row. **Still never run** — see blockers. |
| `scripts/generate-icons.ts` | PWA icons. |

`scripts/import-media-local.ts` no longer exists (deleted with `public/media/`).

Real-world compression results for reference: a 279 MB 8K phone video → 10.7 MB;
1080p Snapchat clips → 2–5 MB.

---

## Remaining blockers & loose ends

1. **`/admin` is still unusable — the owner account was never created.**
   `auth.users` and `admin_users` are still empty. Everything it needs is now
   in place; one command remains (owner picks the password):
   ```bash
   NODE_OPTIONS=--experimental-websocket npx tsx scripts/create-owner.ts --password "<strong-password>"
   ```
2. **Connect GitHub auto-deploys** (now safe — see Deployment).
3. **Uncommitted work.** As of this snapshot the working tree holds: the video
   import pipeline, the landing-page panel logic, `.vercelignore`, deletion of
   the local-media bridge, `my_data/` gitignore entry, README/HANDOFF updates —
   plus the owner's landing-page feature (`src/components/home/`, header, nav,
   i18n, `motion` dependency). None of it is committed.
4. **بئر غرس pin** — owner should drag the admin pin (or compare with their
   maps link) to confirm; note the two coordinate-bearing links for أنيف and
   السبعة مساجد were extracted exactly.
5. Everything from the old list that still stands: the six placeholder places
   need owner review; four drafts need content; Quba `[VERIFY]` items; no
   automated tests; no real mobile-browser pass; no Lighthouse run; the
   adversarial code review was never re-run.

---

## Architecture decisions worth not undoing

(Unchanged from the previous handoff, all still true.)

| Decision | Why |
| --- | --- |
| **maplibre-gl pinned to `^5`** | v6 is ESM-only; its worker chunk broke the dev server (blank map). |
| **No `next/image`; plain `<img>` + explicit srcset** | Only 400/800/1600 variants exist; a loader made phones pull 1600px files. |
| **`NEXT_PUBLIC_SITE_URL` unset on Vercel** | Falls back to `VERCEL_PROJECT_PRODUCTION_URL`; setting it wrongly poisons canonicals. |
| **`PublicPlaceView` DTO** | Keeps `[VERIFY]` text and `admin_notes_ar` out of public page payloads. |
| **`/~offline` in `additionalPrecacheEntries`** | Serwist fallback must be precached or offline breaks. |
| **Admin i18n namespace stripped from root layout** | Public pages must not ship admin strings. |
| **MapLibre + OpenFreeMap, self-hosted RTL plugin 0.2.3** | Free, token-less; 0.3.0 breaks Arabic labels with MapLibre. |

New entries:

| Decision | Why |
| --- | --- |
| **Videos re-encoded at import, never uploaded raw** | Bucket caps files at 50 MB / `video/mp4` only; phone originals hit 279 MB. Also strips GPS the same way photo EXIF is stripped. |
| **Video scale filter uses ffmpeg expressions, not probe dimensions** | ffprobe reports pre-rotation dimensions; portrait phone videos would get squeezed to 406×720 otherwise. |
| **Story panels pick by photo availability** | A cinematic landing with placeholder full-bleeds looks broken; the featured flag alone doesn't guarantee imagery. |

---

## Local development

```bash
cd C:\Users\IVGeekom\Desktop\2026\Islam\hidden-madinah
npm run dev          # http://localhost:3000
```

Quality gates (all clean as of this snapshot): `npx tsc --noEmit`,
`npx eslint src scripts --max-warnings=0`, `npm run build`.

Windows gotchas (unchanged): orphaned servers holding port 3000
(`netstat -ano | findstr :3000`); `EPERM … .next\trace` → kill stray node,
`rm -rf .next`. **Supabase free tier pauses after ~1 week idle** — restore from
the dashboard if the site suddenly errors.

---

## Suggested next moves

1. Create the owner account (blocker 1) — then the owner can review the six
   placeholder places and fix the بئر غرس pin themselves in `/admin`.
2. Commit the current working tree and connect GitHub auto-deploys.
3. Owner photographs/writes the four remaining drafts near Quba — publishing
   them lights up the "أماكن خفية قريبة" section on the Quba page.
4. Review pass + mobile-width check + Lighthouse before promoting the site.
5. Keep growing toward the 30–50 places `research.md` calls the launch threshold.
