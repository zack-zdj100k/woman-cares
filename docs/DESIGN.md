# Design system

## Direction

Romantic editorial beauty, grounded in the owner's own references: blush rose filigree, a lavender
garland, blush butterflies, parchment with lilies, lavender-edged parchment and noir roses, plus two
recorded hero references ("Glowence" and "Norvik Slowhouse"). The site should feel like a calm,
well-lit salon: warm light, rose accents, serif display type, soft but precise motion.

## Owner direction (2026-10-16)

The owner supplied nine references, applied as follows (no brand copied; patterns only):

| Ref | Where | What we took |
|---|---|---|
| 1 + 2 Parchment with lilies, blush roses frame | Whole site | Blended into one page texture; their flowers sit in the viewport corners (`SiteBackdrop`, built by `scripts/build-backgrounds.mjs` from `assets/source/`) |
| 3 Profile screenshot | Profile page | Was rendering in dark mode: the site is now **light only** |
| 4 Travel cards | Every listing card | `SoftCard`: white card, title + pill badge, meta line, price beside a glossy "Réserver" pill with an arrow dot, photo with glass tags; picture top or bottom alternates |
| 5 Beauty studio | Home after the film | Title + list of the six universes beside a photo with floating glass chips; "Pourquoi" ringed centre with four numbered cards; tabbed bento of categories; featured treatment around a round film |
| 6 Dark wellness | Notre histoire | Cinematic warm-dark panels (cocoa `#1d1316`, champagne `#d9b88f`) set on the light floral page; circles row; before/after cards |
| 7 Retreat landing | Pour les pros | Film hero with an orbit badge; numbered image cards; snap gallery; dark card with an example request (labelled as an example); numbered questions; live pricing |
| 8 Soft controls | Buttons, tabs | Glossy plum-black primary pill, soft white secondary, white tray segmented control with a black active pill |
| 9 Glass bars | Navbar, menu | No bar (owner, 2026-10-16): links float on their own (light over the film, ink on the floral pages) beside round smoky-glass buttons (logo, search, menu). Once the page scrolls (24 px) the links fade and only the round buttons float |
| 11 Glass cards (GSAP) | Notre histoire, founding story | `GlassCardsTrack` (`src/components/ui/glass-cards.tsx`): the owner's stacked glass cards turned sideways. From 768 px the section pins and scrolling moves the cards left to right (right to left in Arabic) with a progress line; each card settles from 92 % as it reaches the centre. Phones and reduced motion get a native swipe row. Light glass with the conic border, no backdrop blur |
| 10 Logistics footer | Footer | Scrolling call to action in photo-filled letters with a rose four-point star, a photo band, and a smoky-glass card overlapping it (brand, Woman Cares, Soins, Contact columns, bottom bar), all on the floral page |

Also from the owner: the hero film is brighter (lighter scrims, `brightness(1.14)`); the menu is a
**half circle docked to the inline-end edge** (`DialMenu`): a small half-disc tab is always visible; it
opens a dial that turns with the wheel, a swipe or the arrow keys; the page facing the screen is
highlighted and opens with a tap or Enter. Key titles use **MaskedHeading** (React Bits, adapted in
`src/components/ui/masked-heading.tsx`): letters are windows onto a photograph tinted wine-rose
(`FilmTitle`); Arabic words are clipped whole so letters keep their joined shapes.

## Tokens (`src/app/globals.css`)

Light only. The page itself is the floral backdrop; surfaces are translucent so it shows through.

| Token | Value | Role |
|---|---|---|
| `--ground` | `#f7ece4` | Solid fallback (dialogs, menus) |
| `--surface` / `--surface-2` | white 62 % / 82 % | Chips, skeletons, quiet fills |
| `--card` + `.card-soft` | white 78 %, blur 14 px, inset highlight, soft shadow | Every content card |
| `--parchment` | white 86 % | Empty states |
| `--ink` / `--ink-2` | `#25161d` / `#5b4550` | Text |
| `--rose` / `--rose-ink` | `#a8445c` / `#8e3249` | Accent: focus, links, selected time, price pill |
| `--wine` | `#3a1420` | Footer and the pro card |
| `.glass-dark` | plum glass 62 %, blur 18 px, sheen | Navbar, dial menu, controls over media |
| `--shadow-soft` / `--shadow-float` | | Card resting / hover |
| `on-media`, `media-ink` | `#fff8f6`, `#25161d` | Over video and photos |

## Type

- Display: **Cormorant Garamond** 500 (+ italic for one accent phrase per headline). Arabic: **Amiri** 700,
  never italic.
- Body/UI: **Outfit**. Arabic: **IBM Plex Sans Arabic**.
- Display line-height 0.95 (Latin) / 1.25 (Arabic). Typographic apostrophes (’) in all French copy.
- Eyebrows: at most one per three sections, sentence case, tracking ≤ 0.02em.

## Shape

Interactive controls are full pills. Cards use 26-36 px radii, nested images 20-24 px. Fields use
`--radius-field` (14 px). Glass is for the navbar, the dial menu and controls over media.

## Performance rules

- `backdrop-filter` only on small or few elements (navbar buttons, dial menu, dialogs); content cards are solid soft white.
- Endless animations use `transform`/`opacity` only (`.float-soft`, the price ring, the footer marquee) and are few per screen.
- Masked titles have no idle drift and stop their animation loop when nothing moves.
- Brightness is baked into the hero video and stills (ffmpeg/sharp), never a CSS filter on playing video.
- Measured on the production build: 16.7 ms average and p95 frame time while scrolling home, Notre histoire and Pour les pros at 1440 and 390 px.

## Motion

- Easing `--ease-soft` = `cubic-bezier(0.16, 1, 0.3, 1)`.
- Scroll-linked values only through Motion `useScroll`/`useTransform` using function-form mappings
  (`src/lib/hero-film.ts#map`); the array form was mis-mapped by Motion's accelerated path.
- Entrances: fade + 28 px lift, once, via `Reveal`.
- Cards float gently (`.float-soft`, 7 s); the profile price pill pulses (`.price-glow`).
- Masked titles rise word by word (GSAP) and drift slowly under the pointer.
- Every animated component honours `prefers-reduced-motion` (no autoplay, no pin, static states).

## Hero film

Glowence contributes the pill nav cluster with a centred wordmark, the serif headline with an italic
accent, a light pill primary CTA beside a glass ghost CTA, the floating glass detail card with a typed
caption, and the modal (here the "Trouver mon soin" search). Norvik contributes the inset rounded film
frame that opens to full bleed, the oversized display title (here the chapter name), and the round
control button (play/pause). Scroll drives four chapters (hair, skin, nails, massage); the chapter rail is
the single chapter control.

## Assets

| Asset | Where | Replace by |
|---|---|---|
| Hero film | `public/media/hero-woman-cares.mp4` (+ `-960.mp4`) | Same filenames; update chapter times in `src/config/categories.ts` |
| Chapter stills | `public/images/hero/chapter-*.jpg` | Frames from the film |
| Pro band clip | `public/media/pro-cta-nails.mp4` + poster | Any portrait 4:5 clip |
| Illustrated frames | `public/images/backgrounds/*.jpg` | Same filenames; CMS-managed in Phase 10 |
| Site backdrop | `public/images/backgrounds/site-texture.webp`, `corner-*.webp` | Replace `assets/source/*` and run `node scripts/build-backgrounds.mjs` |
