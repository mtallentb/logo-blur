# LogoBlur — MVP product note

**One-liner:** Wordle-for-logos — five daily blurred brands, sharpen or guess, share a spoiler-safe emoji card.

## Why it works

- Same puzzle for everyone (shared Chicago date seed) → social proof and FOMO.
- Instant comprehension: blur → sharpen or type, no tutorial.
- Share card has **no brand names** → safe to post in Slack / X / group chats.
- Streak + /1000 score + reveal count → retention loop without accounts.
- Sibling to [Timeline](../timeline/) — same daily-game DNA, different mechanic.

## Ship today

Static files under `/workspace/logoblur/`. Host on any CDN or object store (Cloudflare Pages, Netlify, GitHub Pages, S3+CloudFront, Railway static). Zero build step.

## Domain options (pick later)

| Domain | Notes |
|--------|--------|
| `logoblur.game` | Brand-forward (placeholder in share text) |
| `playlogoblur.com` | Clear CTA |
| `dailylogoblur.com` | SEO-friendly “daily” keyword |
| Subpath on Timeline host | Soft launch next to Timeline |

## Assets risk (read this)

Trademarked logos are the main legal surface. MVP uses:

- **Simple Icons (CC0)** silhouettes + **initial tiles** as honest demo placeholders.
- README attribution + trademark disclaimer.

Before a public launch with real logo artwork:

1. License assets or use APIs with clear commercial ToS (e.g. Clearbit — verify current terms).
2. Or stay on Simple Icons / custom wordmarks and lean into “silhouette mode.”
3. Add a visible “unofficial / not affiliated” footer.

## Monetization (later)

1. **Launch clean** — no ads week 1–2; watch share rate and D1/D7 return.
2. **Light display ads** — footer banner only on the end screen.
3. **Tip jar** — indie daily-game culture.
4. **Sponsored logo packs** — “Tech Tuesday” branded days without polluting the core seed.

## Hosting days later

- Service worker for true offline.
- Archive past days at `/archive/YYYY-MM-DD`.
- Difficulty curves: easier brands on weekends; hard-mode toggle (no sharpen, or start blurrier).
- Analytics: Plausible or Cloudflare Web Analytics.
- Edge-cache HTML + `logos.json` + SVGs; still no server logic required.

## Success metrics (first 30 days)

- Shares copied / completes
- Median sharpens per day
- Streak distribution (1 / 3 / 7+)
- Mobile vs desktop play ratio
- Wrong-guess rate (alias gaps)

## Non-goals for MVP

Accounts, live multiplayer, user-submitted logos, push notifications, paid streaks, scraping brand CDNs.
