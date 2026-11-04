# S Mart design system

Brand: **S Mart** (original name and mark; not derived from any reference app).

## Palette "Ink & Marigold"
Taken from the build brief at `/home/user/tab/files/smart/WEB_BRIEF.md`:

> paper #F6F4EE, surface #FFFFFF, ink #15191E, muted #566070, line #E2DED3, primary slate-ink #1E2B3A (hover #14202C), soft #E6EAEF, accent marigold #D98E04 (text-safe on white #8A5A00, soft #FBEFD2), success #1F7A4C, danger #B3261E, info #3E5C76. Dark: bg #101418, surface #182029, line #28323D, text #E9EDF1, muted #9AA6B2, primary #A9BDD3, accent #F0B33C. Check contrast (AA). Fonts via next/font (self-hosted at build): display Fraunces (variable, soft optical sizes), UI/body DM Sans. Logo: an original SVG mark in code: a rounded-square monogram built from the letter S formed by two offset marigold/ink bars (design your own simple geometric S), wordmark 'S Mart' in Fraunces. Premium editorial taste: strong type scale, generous whitespace, thin rules, subtle motion (fade/translate <=200ms, respects prefers-reduced-motion), no emoji icons, no excessive gradients/glow/glass/purple neon; use an inline SVG icon set you write (or lucide-react, MIT) consistently. Light/dark toggle, responsive at 375/768/1024/1440, loading skeletons, empty states, error states with retry, accessible forms (labels, aria, focus rings, keyboard), axe-core clean on key pages (run @axe-core/playwright and report violations; fix serious/critical).

Paper-white surfaces, a deep slate ink for text and primary actions, and a single marigold accent used sparingly (the text-safe darker marigold is used for text on white). The palette was composed following the project's design workflow notes and logged to `palettes_log.md`; **no external palette site (Coolors) and no 21st.dev component library were used** for this palette.

## Typography
- Display: **Fraunces** (variable, soft optical sizes) for headlines and the wordmark.
- UI/body: **DM Sans**.
- Both loaded through `next/font` (self-hosted at build, no runtime CDN). Strong type scale, generous whitespace, thin 1px rules instead of heavy boxes.

## Logo concept
An original SVG mark in code: a rounded-square monogram where the letter S is built from two offset bars (ink and marigold), with the wordmark "S Mart" in Fraunces. Geometric, no basket/bag clip-art, no gradient.

## Motion
Subtle fades and translations of 200 ms or less, no parallax or looping animation; everything respects `prefers-reduced-motion` (movement removed, state changes still visible).

## Accessibility rules
Contrast AA minimum in light and dark; visible focus rings; labels on all inputs; keyboard reachable menus and dialogs; status never conveyed by colour alone; touch targets of at least 44 px on the customer site; axe checks are part of the web workers' test scope (results in the parent report).

## Layout principles
Customer site: editorial product grids with large imagery, one primary action per screen. Admin site: dense tables with filters, sticky headers, clear empty/loading/error states, light and dark themes.

## How it differs from earlier looks
Earlier builds used other directions: Basta (school portal), Byawastha, AAMA (white pages, navy text, rani-pink accent, Jost) and the School Management System (see those repos). S Mart deliberately avoids pink/burgundy accents and Jost, uses warm paper + slate ink + marigold, and a serif display face. It also avoids the reference app's branding (see REFERENCE_ANALYSIS.md).
