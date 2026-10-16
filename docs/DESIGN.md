# Design system

## Direction

Romantic editorial beauty, grounded in the owner's own references: blush rose filigree, a lavender
garland, blush butterflies, parchment with lilies, lavender-edged parchment and noir roses, plus two
recorded hero references ("Glowence" and "Norvik Slowhouse"). The site should feel like a calm,
well-lit salon: warm light, rose accents, serif display type, soft but precise motion.

## Tokens (`src/app/globals.css`)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--ground` | `#fbf4f2` | `#160e12` | Page background (blush, not beige) |
| `--surface` / `--surface-2` | `#f5e6e4` / `#eddad7` | `#21151b` / `#2c1d24` | Section tints, skeletons |
| `--parchment` | `#f4eadf` | `#2a1f1f` | Dialogs, empty states |
| `--ink` / `--ink-2` | `#25161d` / `#5b4550` | `#f6e9ec` / `#cbb4bc` | Text |
| `--rose` / `--rose-ink` | `#a8445c` / `#8e3249` | `#e07d96` / `#f0a3b6` | The single accent: primary buttons, links, focus |
| `--wine` | `#3a1420` | `#0f080b` | Hero ground, pro band and footer (one deliberate colour block) |
| `--lavender` | `#8b79a8` | same | Tint only, never a button |
| `on-media`, `on-media-accent`, `media-ink` | `#fff8f6`, `#f6c9d3`, `#25161d` | fixed | Over video/photos/illustrations, never theme-switched |

## Type

- Display: **Cormorant Garamond** 500 (+ italic for one accent phrase per headline). Arabic: **Amiri** 700,
  never italic.
- Body/UI: **Outfit**. Arabic: **IBM Plex Sans Arabic**.
- Display line-height 0.95 (Latin) / 1.25 (Arabic). Typographic apostrophes (’) in all French copy.
- Eyebrows: at most one per three sections, sentence case, tracking ≤ 0.02em.

## Shape

Interactive controls are full pills. Media and cards use `--radius-media` (28 px). Fields use
`--radius-field` (14 px). Glass is reserved for controls floating over the hero film.

## Motion

- Easing `--ease-soft` = `cubic-bezier(0.16, 1, 0.3, 1)`.
- Scroll-linked values only through Motion `useScroll`/`useTransform` using function-form mappings
  (`src/lib/hero-film.ts#map`); the array form was mis-mapped by Motion's accelerated path.
- Entrances: fade + 28 px lift, once, via `Reveal`.
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
