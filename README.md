# SkillConnect

A barangay skilled-workers directory — plain HTML/CSS/JavaScript, no build step,
no backend required. Data is stored in the browser via `localStorage`, seeded
with demo accounts, 12 workers and 30 service requests the first time it loads.

Everything runs offline: the map, the chatbot and the photo handling all work
with no internet connection, so a demo or defense on a school LAN is safe.

## Run it

```
python3 -m http.server 8080
# or
npx serve .
```

Then visit `http://localhost:8080`.

## Pages

- `index.html` — public landing page (live worker directory preview,
  announcements, testimonials, FAQ).
- `login.html` / `register.html` — authentication. Registering as a
  "Skilled worker" creates an unverified profile; an admin must verify it
  before it appears publicly.
- `customer.html` — **resident dashboard**: feed of submitted requests with
  live status, a new-request form with **photo attachments**, and
  **Find a Worker** — an interactive map plus a directory sorted by distance.
- `worker.html` — **worker dashboard**: job feed filtered to the worker's own
  skill category (Available / Pending / Working / Completed), a map of open
  jobs sorted nearest-first, an availability switch, and a profile editor with
  **certificates** and **past-work photos**.
- `admin.html` — **barangay/PESO admin dashboard**: analytics overview,
  requests table (assign, change status, delete, view attached photos),
  workers table with a **Proof** column for reviewing uploaded credentials
  before verifying, and a residents table.

## Demo accounts

| Role     | Email                     | Password     |
|----------|---------------------------|--------------|
| Resident | maria@gmail.com           | customer123  |
| Worker   | ramon@skillconnect.ph     | worker123    |
| Admin    | admin@skillconnect.ph     | admin123     |

Every seeded resident uses `customer123` and every seeded worker `worker123`
— see `assets/js/db.js` for the full list.

## Feature notes

### Map (`assets/js/map.js`)

A dependency-free SVG map of the service area: coastline, river, road network
and the six barangay centres, with pan, zoom, hover tooltips and click-to-select
pins. Pin colours follow availability (green available, amber busy, grey
offline, clay open job) and the pulsing blue pin is the signed-in user.

Coordinates live in `DB.BARANGAY_GEO` and the drawing area in `DB.MAP_BOUNDS`.
The values are **approximate positions for Calapan City, Oriental Mindoro** —
replace them with surveyed coordinates before any real deployment. Distances
shown in the UI are true great-circle distances (`DB.distanceKm`); pins may be
nudged apart visually when they overlap, but the numbers are unaffected.

To move to a real tile map (Leaflet + OpenStreetMap) later, only `map.js`
changes — the pages just pass it a list of `{ id, lat, lng, label, kind }`.

### Photos

Uploads are resized to 900px on the long edge and re-encoded as JPEG (quality
0.72) in a canvas before being stored as data-URLs, so a 4MB phone photo
becomes roughly 80KB. `localStorage` holds about 5MB in total, so residents
get 4 photos per request and workers 1 per portfolio entry. If the quota is
ever hit, `DB` shows a toast instead of failing silently.

Shared helpers live in `assets/js/ui.js`: `UI.photoPicker()`, `UI.gallery()`,
`UI.bindLightbox()`, `UI.compressImage()`.

### Worker credibility

Workers can upload **certificates** (title, issuer, year, optional photo of the
document) and **photos of past work** with captions. Residents see both in the
worker profile modal; admins review them in the Proof column before verifying.
A credibility checklist on the worker profile shows what is still missing.

### Chatbot — "Konek" (`assets/js/chatbot.js`)

A floating assistant on every page, using `assets/img/bot.png` as its avatar.
It is rule-based and reads the same `DB` the pages use, so its answers stay
correct as data changes. It handles:

- repair cost ranges per trade (from `DB.RATE_CARD`)
- the nearest available worker and how far away they are
- how to submit a request and what photos to attach
- ticket status for the signed-in resident
- how verification, certificates and ratings work
- open job counts, service categories, office contact

It understands common Taglish phrasing ("magkano", "malapit", "paano").

**The prices in `DB.RATE_CARD` are plausible estimates, not surveyed barangay
rates.** Replace them with real figures before presenting or deploying.

To upgrade to a real language model later, replace the `answer()` function and
keep its return shape: `{ html: string, chips: [string] }`.

## Structure

```
skillconnect/
├── index.html            landing page
├── login.html
├── register.html
├── customer.html         resident dashboard shell (rendered by customer.js)
├── worker.html           worker dashboard shell (rendered by worker.js)
├── admin.html            admin dashboard shell (rendered by admin.js)
├── assets/
│   ├── css/styles.css    design system + dashboard, map, photo & chatbot styles
│   ├── js/
│   │   ├── db.js          mock database (localStorage), geo data, rate card, seed data
│   │   ├── auth.js        login/register/session/route-guard helpers
│   │   ├── ui.js          shared shell, photo picker, gallery, lightbox
│   │   ├── map.js         SVG barangay map component
│   │   ├── chatbot.js     floating assistant
│   │   ├── landing.js     landing page interactions
│   │   ├── customer.js    resident dashboard logic
│   │   ├── worker.js      worker dashboard logic
│   │   └── admin.js       admin dashboard logic
│   └── img/               trade photography + bot.png (chatbot avatar)
└── README.md
```

## Wiring to a real backend later

Everything talks to the app through the single `DB` object in `db.js`. To swap
in a real API (Strapi, Supabase, your own REST service), replace the bodies of
`DB`'s methods (`getUsers`, `createRequest`, `addCertificate`, etc.) with
`fetch()` calls — nothing in the page scripts needs to change. Photos would
move from data-URLs to uploaded files with URLs stored instead.

## Notes

- Passwords are stored in plain text in `localStorage` for this demo only —
  never do this in a real deployment.
- The storage key is `skillconnect_v2`. To reset all data back to the seeded
  demo state, open the browser console and run `DB.reset()`, then refresh.
