# LogoBlur

A daily shareable logo-guessing game. Same 5 logos for everyone on a given calendar day (America/Chicago).

## Play online

https://logo-blur-production.up.railway.app/

Intended GitHub Pages URL (enable in repo Settings → Pages → Deploy from branch `main`, folder `/`):
https://mtallentb.github.io/logo-blur/

## Play locally

```bash
# from the repository root
python -m http.server 8766
```

Open [http://localhost:8766](http://localhost:8766) in a browser.

Or open `index.html` via any static file server. Prefer HTTP over `file://` so `logos.json` and SVG assets load via `fetch` / `<img>`.

**Offline:** After the first load (with network), the page, JSON, and SVGs are cached by the browser for that origin; for true offline shipping later, add a service worker. The game logic itself needs no network once assets are loaded.

## Files

| Path | Purpose |
|------|---------|
| `index.html` | Shell page |
| `app.js` | Puzzle seed, blur, fuzzy match, scoring, share, streak |
| `styles.css` | Dark mobile-friendly UI |
| `logos.json` | Curated brands (id, name, aliases, color, optional svg) |
| `logos/` | Vendored [Simple Icons](https://simpleicons.org/) SVGs (CC0) |
| `MVP.md` | Product note |
| `Dockerfile` | Tiny Python static server for Railway (`PORT`) |
| `README.md` | This file |

## How it works

1. **Daily seed** — Date key is today's date in `America/Chicago` (`YYYY-MM-DD`). A deterministic hash of `logoblur:{dateKey}` shuffles the brand pool and picks 5 logos.
2. **Each round** — A logo starts heavily blurred (CSS `filter: blur`). Tap **Sharpen** to reduce blur (costs potential points) or type the brand name anytime.
3. **Guess** — Fuzzy match against `name` + `aliases[]` (normalization + light Levenshtein). Wrong guesses stay on the same logo; **Skip** ends the round as a miss.
4. **Reveal** — Brand name, sharpens used, points, emoji tier. Then next logo.
5. **End** — Score out of 1000, correct count, total reveals, streak in `localStorage`, spoiler-safe share card.

## Scoring

Per logo (max **200** points):

```
if correct:  points = max(0, 200 - sharpens × 40)
if miss:     points = 0
```

| Sharpens | Points (if correct) |
|----------|---------------------|
| 0 | 200 |
| 1 | 160 |
| 2 | 120 |
| 3 | 80 |
| 4 | 40 |
| 5 | 0 |

Perfect day (all 5 with 0 sharpens) = **1000**.

### Emoji tiers (share card — “how early”)

| Emoji | Condition |
|-------|-----------|
| 🟩 | Correct with 0–1 sharpens |
| 🟨 | Correct with 2–3 sharpens |
| 🟥 | Miss / skip, or correct with 4+ sharpens |

### Share format (no brand names)

```
LogoBlur MM/DD  🟩🟩🟨🟥🟩  4/5 · 7 reveals
🔥 Streak: 3
https://logo-blur-production.up.railway.app/
```

One-tap **Copy share card** copies that text to the clipboard.

## Streak

Stored in `localStorage` under key `logoblur_v1`. Increments when you finish consecutive Chicago calendar days; resets if you skip a day. Replaying the same day does not double-count.

## Assets & licensing

**MVP approach:** Demo logos — not full trademark artwork.

1. **Simple Icons (CC0)** — Monochrome brand SVGs vendored under `logos/`. Source: [simpleicons.org](https://simpleicons.org/) / [github.com/simple-icons/simple-icons](https://github.com/simple-icons/simple-icons). CC0 dedication; brand names/marks remain trademarks of their owners. Used here as identifiable silhouettes for a guessing game demo.
2. **Initial-letter tiles** — Brands without a vendored SVG use a colored tile + initials (honest placeholder mode).

**Production:** Licensed logo packs, Clearbit Logo API (check ToS), or Simple Icons with clear attribution and trademark disclaimers. Do not scrape brand CDNs without a license. This MVP does not ship trademarked full-color logo image files from brand press kits.

Trademark disclaimer: Brand names and logos are property of their respective owners. LogoBlur is an unofficial fan game and is not affiliated with any brand depicted.

## Fuzzy aliases (examples)

Aliases live in `logos.json`. Common ones:

| Brand | Also accepts |
|-------|----------------|
| Meta | facebook, fb |
| Google | alphabet |
| X | twitter |
| YouTube | yt |
| Coca-Cola | coke, coca cola |
| McDonald's | mcdonalds, mcd |

Prefer names people actually type (Meta/Facebook both OK; “Alphabet” is an alias for Google, not the primary prompt).

## Extending the brand pool

Add objects to `logos.json`:

```json
{
  "id": "acme",
  "name": "Acme",
  "aliases": ["acme corp"],
  "color": "#FF6600",
  "svg": "logos/acme.svg"
}
```

Omit `svg` to use an initial-letter tile. Drop a CC0 Simple Icons file into `logos/` when available.
