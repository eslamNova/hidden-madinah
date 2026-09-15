# مزارات المدينة — Mazarat Madinah

**A field guide to the Madinah that visitors never find.**

Millions come to Madinah every year. Almost all of them see the same three places. This app is for the rest of the city — the wells, gardens, early mosques and battle positions that are historically real, physically reachable, and effectively invisible to the people standing a few kilometres away from them.

**Live:** <https://mazarat-madinah.com> · **Channel:** [Telegram](https://t.me/+j_RAlim-5ZE2MTJk)

---

# Part 1 — The idea

## The problem

A visitor with a free afternoon in Madinah has no usable way to find anything beyond المسجد النبوي، قباء، أحد.

- **The information is scattered.** It lives in seerah literature, local knowledge, and forum posts — not in one place, and rarely in a form you can act on while standing on a street.
- **Authenticity is unclear.** Sites of genuine historical significance sit alongside folklore with no way for a visitor to tell them apart. Getting this wrong in a religious context is not a small error.
- **The practical half is missing entirely.** Even when a visitor learns a site exists, nothing tells them how far it is, how to get there, what a taxi should cost, when to go, or whether it is open.
- **Operators have no incentive to fix it.** Tour packages sell the same fixed circuit, because that circuit is what people already know to ask for.

The result: a visitor who wanted to see more leaves having seen what everyone else saw.

## What it is

An Arabic-first, installable web app. Every place carries three things:

1. **The story** (القصة) — what happened here, and why it matters.
2. **The virtue** (الفضل) — with the hadith sourced, or marked as unverified and withheld.
3. **The logistics** — distance from the Prophet's Mosque, drive time, taxi cost range, best time of day, opening status, and how to actually get there.

Plus the owner's own photography and video of each site, a map, curated multi-stop routes, and a full-screen photo tour for browsing before you go.

## Why it works

**It is built for the trip, not for the desk.** Offline-capable PWA, map bounds-locked to Madinah, nearest-places from your location. It is meant to be open in your hand at the site, on a phone, possibly with weak signal.

**It is built for who actually goes.** The audience skews older than a typical app's. So: 18px base type with a persistent size stepper, zoom never disabled, ≥48px touch targets everywhere, labeled navigation, and a two-tone focus ring that survives dark photography. These are not afterthoughts — they are structural constraints the whole design answers to.

**Provenance is enforced in the tooling.** Any unverified claim gets a `[VERIFY]` marker; marked text is stripped from every public payload automatically and surfaces in the admin as a review badge. Nothing uncertain reaches a visitor by accident.

**The media is original.** Every photo and video is the owner's own, shot on site. Not stock, not scraped.

## Where it stands today

Verified against the production database, 15 September 2026:

| | |
|---|---|
| Published places | **10** |
| In the pipeline (drafted, awaiting content/photos) | 8 |
| Original media assets | **84** — 65 photos, 19 videos |
| Categories covered | Mosques (6), historical sites (2), gardens (1), wells (1) |
| Curated routes | 1 (جولة قباء) |
| Monthly infrastructure cost | **≈ $0** — Vercel Hobby, Supabase free tier, Cloudflare R2 (zero egress) |

**Signals so far:**

- Live on a custom domain, installable, fully offline-capable.
- **Unsolicited inbound interest from companies wanting to advertise** — before any outreach, any media kit, or any ad product existing.
- Analytics instrumented 8 September 2026 (GA4 + Vercel Analytics, consent-gated). Measurement is young by design — the history starts here.

> **To fill before sending:** current monthly visitors and top pages (GA → Reports → Engagement → Pages and screens), and a sourced figure for annual Umrah/ziyarah visitors to Madinah. Both are deliberately left blank rather than estimated.

## Business model

**Direct sponsorships from vetted, relevant businesses.** Umrah operators, hotels near the Haram, ziyarah transport, Islamic publishers. Flat monthly placement in list and index views, clearly labeled.

**Explicitly not programmatic advertising.** An ad exchange serving interest-based loans, gambling or immodest creative next to content about Madinah's sacred sites is an unrecoverable trust failure, and trust is the entire asset. Direct deals mean every creative is approved. They also pay materially better at this scale than display RPM would.

Constraints held deliberately: no interstitials, nothing that interrupts a tour, no third-party tracking pixels, sponsor media served from the same zero-egress CDN as everything else.

**Adjacent, later:** operator partnerships (routes as bookable itineraries), audio narration, per-site QR signage.

## What comes next

**Content is the bottleneck, and it is the whole product.** Internal research sets 30–50 published places as the threshold where the app stops being a curiosity and starts being the reference. That is the primary use of any investment: field trips, photography, and historical verification.

Then, in order: English localization (the i18n layer is already in place), audio narration per place, a route builder in the admin, and favorites/trip planning.

## Honest risks

- **Content velocity depends on one person.** Every place requires a site visit, original photography, and historical verification. This does not parallelize easily and is the real constraint on growth.
- **Seasonality.** Traffic will concentrate around Ramadan and Hajj. Annualized figures will mislead in both directions.
- **Infrastructure is on free tiers.** Supabase pauses after ~1 week idle — fine today, must be paid before any promotion.
- **Analytics history is one week old.** Anyone evaluating traction should know the measurement, not just the product, is new.

---

# Part 2 — Technical documentation

**Stack:** Next.js 15 (App Router, SSG/ISR) + TypeScript · Supabase (Postgres, Auth, Storage) · Cloudflare R2 for media delivery · MapLibre GL v5 with OpenFreeMap tiles · Serwist PWA (offline) · Tailwind CSS v4 · next-intl · motion/react · GA4 (consent-gated) + Vercel Analytics.

## What the app has

### Public experience

- **Story landing (`/`)** — a full-screen cinematic snap-scroll "cover": daily-rotating hero photo of المسجد النبوي (static asset pool in `public/hero`, regenerated by `scripts/build-hero.ts`), featured-place panels, category tiles, routes, and a farewell panel. Progress dots, floating next-button, scroll hint.
- **Photo tour (`/tour`)** — an auto-playing, full-bleed, reels-style slideshow through *every* published place's media (photos 6s, video posters 9s), with a per-slide progress bar, pause/play, full place summary under each frame, and an open-place link. The clock waits for each frame to actually load (spinner on slow links, next frame pre-fetched). Videos never autoplay; if tapped, the show waits for the clip to end. Entered via the sheen "جولة مصوّرة" CTA on the landing's opening and closing panels.
- **Per-place tour (`/places/[slug]/tour`)** — the same viewer scoped to one place, opened from the sheen "شاهد الصور والفيديو" button in every place hero; big labeled "إنهاء" exit returns to the place.
- **Places (`/places`)** — photo-led page header, Arabic-normalized search, category/distance/best-time filter chips, photographic card grid (title + distance/time chips over a dark scrim), and on-request geolocation "nearest places".
- **Place pages (`/places/[slug]`)** — 62dvh photo hero with the media-tour button, quote callout (آية/حديث in thmanyah Serif Display), visit-info card, swipeable gallery (labeled next/prev + dots, pinch-zoom, video players), story, virtue, tips, lazy map with pin, the «سيرة» companion-app card, related places.
- **Map (`/map`)** — full-screen MapLibre map bounds-locked to Madinah, category-colored 48px pins with name captions, legend, bottom-sheet place preview. Pins are SSG-rendered (no client fetch).
- **Routes (`/routes`, `/routes/[slug]`)** — curated multi-stop walking/driving tours with cover photos, connecting map line, and total distance. Legacy UUID URLs redirect to slugs.
- **Privacy notice (`/privacy`)** — what is collected, what never is, and a one-tap control to grant or withdraw analytics consent.
- **Companion app** — every place page and the landing's farewell panel recommend «سيرة — السيرة النبوية» (free third-party Seerah audio journey); links live in `src/lib/constants.ts` (`SEERAH_APP`).
- **Telegram channel** — a 48px icon in the free top corner of every hero (physical top-LEFT in RTL, mirroring the أ control), a slim row on the landing's closing panel, and a full card at the foot of `/places`. Not on `/map` (its physical left holds the legend and zoom controls) and not on tours, which are deliberately chrome-less.
- **Share previews** — `public/og-image.jpg` (1200×630, 56 kB) is the `og:image`/Twitter card for every non-place page; place pages use their own photo. Icons (tab, Apple touch, PWA, maskable) and the share image are all generated by `scripts/generate-icons.ts`.

### Design system

**Light and dark themes.** The floating top control (أ + ☾/☀) holds the أ−/أ+ font stepper and the theme toggle; the choice persists (`hm-theme`), defaults to dark, and is applied pre-paint. Color tokens come in two families (see `globals.css`): THEMED ones flip in dark mode (`sand`, `surface`, `ink`, `muted`, `brand`) while CONSTANT ones never do (`basalt` for scrims/pins/dark glass, `paper` for light text on dark, `primary` for brand buttons). Rule of thumb: `text-ink` on themed surfaces, `text-paper` on photography/dark glass. Maps switch to OpenFreeMap's dark style and re-create in place (camera preserved).

Light, elevated look: soft surface→sand gradient ground (`body::before`), photo-led page headers that melt into the body (`PageHero` + `.hero-melt`), elevated cards (`.card-elevated`), floating dock navigation (no top navbar), floating أ text-size control, iOS-feel motion (`.press` tap feedback, sheet slide-up, image fade-in, sheen CTA) — all `backdrop-blur`-free over scrolling content, all respecting `prefers-reduced-motion`. Cosmetic scrollbars hidden (`.scrollbar-hidden`); the document scrollbar is thin and brand-tinted.

**Typeface — thmanyah (licensed, read before touching `src/fonts/`).** thmanyah Sans for headings and body (400/500/700), thmanyah Serif Display for the wordmark and featured quotes (700, deliberately not preloaded). Self-hosted via `next/font/local` from `src/fonts/`.

The licence (`my_data/Thmanyah-Font-Family.zip` → `LICENSE.pdf`; the Arabic text prevails) forbids hosting the font for download, hotlinking, and *modification*. Self-hosting for on-site rendering was granted in writing by thmanyah (Khalid, 2026-09-08) on the conditions that we publish no direct download link and block hotlinking. Therefore:

- **Never subset, convert or otherwise process these files** — subsetting is modification (تعديل/تكييف) and is not covered by the grant. `next/font/local` ships local files byte-for-byte; keep it that way.
- The CORS rule in `next.config.ts` narrows `Access-Control-Allow-Origin` on `/_next/static/media/*.woff2` to the production origin. Vercel's default is `*`, which is precisely what allows hotlinking — do not remove that rule. If the production domain ever changes, update it there too.
- `next/font/local` emits content-hashed filenames, so there is no guessable path and no download link.

### iOS specifics

`viewport-fit=cover` lets the landing and tours extend under the notch/home bar; immersive routes mark `<html data-immersive>` so the page ground behind them is dark (no sand bands in safe areas or overscroll). Videos need a tap (iOS never autoplays; neither do we).

### Accessibility (elderly-first, non-negotiable)

18px base font with a persisted أ−/أ+ stepper (18/20/23px, applied pre-paint), zoom never disabled, ≥48px touch targets everywhere (including map pins and zoom controls), two-tone focus ring that survives dark photography, labeled nav, aria-live announcements, reduced-motion coverage including programmatic scrolls.

### Analytics and consent

Two trackers on purpose, failing in opposite directions:

- **Vercel Analytics** — cookieless, served first-party, so blockers cannot shave it. This is the count to quote.
- **GA4** (`NEXT_PUBLIC_GA_ID`, production only) — undercounts, but carries geography, referrer and retention detail that partners recognise.

GA4 writes a first-party cookie, which Saudi PDPL treats as personal data, so the tag is not merely gated but **unmounted** until consent: nothing is requested and no cookie is written before the visitor answers. `SiteAnalytics` owns the decision; `src/lib/consent.ts` persists it (`hm-consent`) and broadcasts changes so the notice, the tag and the `/privacy` control stay in sync. The notice floats above the dock rather than covering it, and is withheld on `/tour` and `/admin`.

gtag is hand-rolled rather than `@next/third-parties` so the mount can be conditional, and uses `usePathname` only — `useSearchParams` at that level would opt every page out of static rendering. Analytics hosts are `NetworkOnly` in the service worker: `defaultCache`'s cross-origin rule would otherwise cache beacons, and a replayed beacon is a visit that never happened.

### Admin CMS (`/admin`)

Auth-gated (Supabase Auth + `admin_users` allowlist + RLS). Place editor covering every content field, transport-options editor, draggable map pin with auto-distance, client-side media upload (EXIF pin pre-fill, canvas resize, EXIF stripped), media reorder/captioning, publish toggle, and "يحتاج مراجعة" badges driven by `[VERIFY: …]` markers.

### Content model

Postgres: `places` (bilingual names, category enum, story/virtue/quote/logistics fields, `related_place_slugs`, pin + distance, publish/featured flags), `media` (photo/video, storage/bunny/youtube providers, variants keyed on URL), `routes` + `route_places`, `admin_users`. RLS: anon reads published content only; `PublicPlaceView` DTO strips `[VERIFY]` markers and `admin_notes_ar` from every public payload (routes descriptions and media captions included).

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

### `.env.local`

| Variable | Required | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public (anon) API key |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts only | Dashboard → Project Settings → API keys → `service_role`. Never commit; never add to Vercel. (Watch out: the *anon* key looks identical — decode the JWT's `role` claim if uploads fail with RLS errors.) |
| `REVALIDATE_SECRET` | optional | Guards `POST /api/revalidate` |
| `NEXT_PUBLIC_SITE_URL` | dev only | `http://localhost:3000` locally |
| `NEXT_PUBLIC_GA_ID` | production only | GA4 measurement ID. Deliberately unset locally and in previews, which keeps both the tag and the consent notice off — dev traffic never lands in the numbers shown to partners. |

**Node 20 note:** supabase-js needs a WebSocket global — run all scripts with `NODE_OPTIONS=--experimental-websocket` (or upgrade to Node 22+).

**Build cache trap:** Next's fetch cache persists in `.next/cache` across builds; with 24h revalidate, a rebuild can silently serve day-old Supabase data. When content changed, always `rm -rf .next && npm run build`.

---

## Supabase

- Project ref `eoicocqjjxskbmctirrb` (region `eu-central-1`, **free tier**).
- Migrations in `supabase/migrations/` (applied); seed in `supabase/seed.sql` (idempotent).
- Free tier: no on-the-fly image transforms (hence pre-generated variants), 1 GB storage, 50 MB/file, `media` bucket allows webp/jpeg/mp4 only.
- **Pauses after ~1 week idle** — restore from the Dashboard if the site suddenly errors; no data is lost.

---

## Media pipeline

Uploads land in Supabase Storage; the public site serves everything from **Cloudflare R2** (`media.mazarat-madinah.com`, zero egress). Importing is therefore two steps.

```bash
# 1. Import a folder of photos and videos for one place
NODE_OPTIONS=--experimental-websocket npx tsx scripts/import-media.ts --dir "<folder>" --slug <place-slug> [--dry-run]

# 2. Copy new objects to R2 and repoint their DB rows (needs `npx wrangler login`)
node scripts/sync-media-to-r2.mjs [--dry-run]
```

- **Photos:** EXIF read first (capture date orders the gallery; GPS suggests the pin, never overwriting owner coordinates) → 400/800/1600 WebP + 1600 JPEG (OG) → Storage → one `media` row (idempotent, keyed on URL). Published files carry **no EXIF/GPS**.
- **Videos** (needs ffmpeg + ffprobe on PATH): rotation-aware re-encode to 720p H.264 (crf 23, faststart), metadata stripped, ≤800px poster frame, `duration_seconds` recorded; per-file error if the result would exceed 50 MB. A 279 MB 8K phone clip lands at ~11 MB.
- **The R2 sync is not optional** — a row still pointing at `supabase.co` is served from Supabase and bills egress against the free tier, which is what forced this split in the first place. The script is idempotent and deliberately serial (parallel `wrangler` processes race the shared OAuth refresh and log the CLI out mid-run).
- Uploads retry with backoff — large files on a slow uplink are the usual "fetch failed" culprit; re-running heals anything (0 duplicate rows).
- Google Photos albums are a **source only** — links expire; downloads usually have GPS already stripped (set pins in the admin).

**Landing hero pool (المسجد النبوي):** 11 owner-selected photos, 3 sizes each in `public/hero/`, manifest `src/lib/hero-images.ts`. Regenerate with `npx tsx scripts/build-hero.ts --dir "my_data/HERO_MASJAD_NABAWY/Selected_HERO"`. Where they appear (rotating by day-of-year): landing opening panel (`day`), landing farewell (`day+1`), `/places` header (`day+2`), `/routes` header fallback; the share image is a fixed crop of the dusk courtyard shot. Deliberately absent from the tour, map and place list — the Prophet's Mosque frames the app but is not one of its "hidden places".

---

## Content review workflow

- `[VERIFY: …]` markers inside any owner text are hidden from visitors automatically (a marker-only field hides its whole row) and surface in `/admin` as a "يحتاج مراجعة" badge.
- `admin_notes_ar` holds private notes (provenance, open questions) that never render publicly.

---

## PWA / offline

Installable; Serwist service worker precaches the shell and `/~offline`, runtime-caches pages, R2 media images and Madinah map tiles/glyphs (videos stay network-only, analytics beacons are `NetworkOnly`). New deploys activate on next launch (no mid-session chunk purging). Test offline in a production build (`npm run build && npm run start`, then DevTools → Network → Offline).

---

## Deployment (Vercel)

Project `eslamnovas-projects/hidden-madinah`, repo <https://github.com/eslamNova/hidden-madinah> (private, branch `master`). Production domain `mazarat-madinah.com` (apex 308-redirects to `www`).

### The standard release flow

Run from the repo root (Git Bash):

```bash
# 1. Verify the code
npx tsc --noEmit
npx eslint src scripts --max-warnings=0

# 2. If content or media changed, push it to R2 first
node scripts/sync-media-to-r2.mjs

# 3. Clean build — ALWAYS clean: Next's fetch cache in .next/cache can serve
#    day-old database data under the 24h revalidate
rm -rf .next && npm run build

# 4. (optional) check it locally — http://localhost:3000, hard-refresh
npx next start          # Ctrl+C to stop

# 5. Deploy to production
npx vercel --prod --scope eslamnovas-projects

# 6. Save the work
git add -A
git commit -m "what changed"
git push origin master
```

Good to know:

- **Vercel builds on its own servers** with fresh database data — step 3 is a safety check, not what ships. If step 3 passes, step 5 will too.
- **Content-only changes** (edits in `/admin`, newly imported media) still need a deploy to appear: pages are static for 24 h. Run steps 2 and 5.
- **Media never rides the deploy** — `.vercelignore` keeps `my_data/` (~1 GB of originals) out; without it the CLI would try to upload it, because the CLI ignores `.gitignore`.
- **Installed PWAs** pick up a new version on the next launch (close and reopen the app).
- **Always pass `--scope eslamnovas-projects`.** Without it the CLI has returned "Not authorized" against this project.
- **Check the deploy actually happened.** The CLI self-updates, and a version bump can silently drop it into a login flow instead of deploying — which looks like success if the output is piped. Confirm with `npx vercel inspect <url> --scope eslamnovas-projects` (expect `target production`, `status ● Ready`) or just curl the live site for the change.
- If `vercel --prod` prints a JSON error blob, re-run it — transient upload hiccups on this uplink are common.
- **Shortcut:** connecting the GitHub repo in Vercel (Project → Settings → Git) turns step 6 into the deploy. Safe now that no media lives in the repo.

### Vercel configuration

- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_GA_ID` (**Production only** — previews must stay untracked). The service key never goes to Vercel.
- Content edits also appear after `POST /api/revalidate` (with `REVALIDATE_SECRET`) without a full deploy.

## Scripts reference

| Script | Command | Purpose |
|---|---|---|
| Import media | `NODE_OPTIONS=--experimental-websocket npx tsx scripts/import-media.ts --dir "<folder>" --slug <slug> [--dry-run]` | Photos + videos → variants/encode → Storage → `media` rows, pin suggestion |
| Sync to R2 | `node scripts/sync-media-to-r2.mjs [--dry-run]` | Copy new Storage objects to R2 and repoint their rows — run after every import |
| Hero pool | `npx tsx scripts/build-hero.ts --dir "<folder>"` | Regenerate `public/hero` variants + `HERO_IMAGES` manifest |
| Create owner | `NODE_OPTIONS=--experimental-websocket npx tsx scripts/create-owner.ts --email <email> --password <pw>` | Owner auth user + admin grant (idempotent) |
| Icons + share image | `npx tsx scripts/generate-icons.ts` | Tab/Apple/PWA/maskable icons + `public/og-image.jpg` |

---

## Future work

**Content (the core loop):**
- Grow from 10 published places toward the **30–50** that `research.md` identifies as the launch threshold. Eight entries are already drafted in the database and need the owner's real content and photos before publishing.
- Resolve the remaining `[VERIFY]` items: أبو بكر's hadith wording/source, جبل الرماة's entry fee, قباء's open-hours/best-time, and the بئر غرس pin confirmation.
- Photos for بستان المستظل (currently video-only; cards use its poster frame).
- More curated routes — only one exists (جولة قباء, 2 stops).

**Product:**
- Sponsor placements: schema, admin field, and a labeled slot in list/index views (see the business model above — direct, vetted, no networks).
- A dedicated `entry_fee` field in schema + visit card (fees currently live inside visiting tips).
- Route builder in the admin (routes are seed-only today).
- Audio narration per place (recorded or TTS) — pairs naturally with the elderly-first audience and the «سيرة» partnership.
- Favorites / trip planner (offline-friendly, localStorage first).
- English localization (next-intl is already in place; content model has `name_en` only).
- Share cards / QR posters per place for on-site signage.

**Engineering:**
- **Connect GitHub auto-deploys** (now safe; do it in Vercel → Settings → Git) — this also removes the silent-deploy-failure class of bug above.
- Automated tests (none exist): start with `stripVerify`/`coverImage` unit tests and a Playwright smoke of the four public routes.
- Lighthouse + real-device pass (mid-range Android). The font swap to thmanyah added roughly 75 kB to the critical path versus the previous Google subsets — dropping thmanyah Sans Medium (500) would claw back 77 kB if field measurement says it matters.
- Upgrade to Node 22+ to drop the `--experimental-websocket` flag.
- **Supabase paid tier** (or scheduled pings) before promoting the site — the free-tier weekly pause is the main availability risk.
