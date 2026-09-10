# Domain, SEO and Landing Pages — Design Spec

Date: 2026-09-10
Status: approved for planning

Sub-project 1 of the "make it useful for 80% of searchers" roadmap. Later
sub-projects (units, onboarding/presets, share link/undo, hardware/sheets/doors,
pull-outs, exports) are out of scope here.

## 1. Goal

Move the planner to `understairsplanner.com`, rename it "Under Stairs Storage
Planner", and surround the app with static, crawlable, multilingual content
pages (landing, how-to-measure, FAQ) in EN, RU, DE, PL, ES, with correct SEO
plumbing (meta, hreflang, structured data, sitemap, robots, llms.txt,
manifest, favicons), cookie-less analytics and Search Console verification.
The app itself gains DE, PL and ES so a visitor never lands on a page in one
language and a tool in another.

Non-goals: `/ideas/` gallery (needs presets, sub-project 3), blog, CMS,
server-side anything, cookie consent.

## 2. Naming

- Product name: **Under Stairs Storage Planner**. Used in `<title>`, OG tags,
  README, `package.json` `name` (`understairs-storage-planner`), app top bar,
  default project name ("Under-stairs cabinet" stays as the *project* name
  default; it is user data, not branding).
- Head keyword phrase: "under stairs storage". Body copy naturally also uses
  "understairs", "under-stair", "cupboard under the stairs", "closet",
  "drawers", "pull-out".
- Localised names:
  - RU: Конструктор шкафа под лестницей
  - DE: Treppenschrank-Planer (body: Stauraum unter der Treppe)
  - PL: Planer zabudowy pod schodami
  - ES: Planificador de armario bajo escalera
- Title tag pattern: `<page title> – Under Stairs Storage Planner` (localised
  brand on non-EN pages).

## 3. URL structure

```
/                      EN landing (also x-default)
/how-to-measure/       EN guide
/faq/                  EN FAQ
/<lang>/               RU/DE/PL/ES landing        lang ∈ ru, de, pl, es
/<lang>/how-to-measure/
/<lang>/faq/
/app/                  the planner (single build; no per-language copy)
/sitemap.xml  /robots.txt  /llms.txt  /CNAME  /site.webmanifest
/favicon.svg  /favicon.ico  /apple-touch-icon.png  /og.png
/img/*.png             landing screenshots
```

Page slugs stay English in every language (simpler, and the keyword lives in
the domain). Trailing-slash directory URLs so GitHub Pages serves
`index.html` without redirects.

App language resolution, in order: `?lang=` query (validated, then persisted
to localStorage and stripped from the URL via `history.replaceState`) →
localStorage → `navigator.language` prefix → `en`. Every content page links
to `/app/?lang=<page lang>`.

Old URL `bynov.dev/under-stairs-planner/` is not redirected (GitHub Pages
project sites cannot redirect). The old site is left as-is until the new
domain is live, then the repo's Pages source switches to the custom domain,
which makes the old path 404. Acceptable; the site is days old.

## 4. Build pipeline

### 4.1 Layout

```
site/
  content.mjs       content for every page × language (see 4.2); source of truth
  template.html     shared shell: <head> meta block, header/nav, footer, slots
  site.css          styles for content pages (no framework)
  generate.mjs      Node ESM script, no deps; writes generated files (see 4.5)
  generate.test.ts  vitest
app/index.html      app entry (moved from repo root); loads /src/main.tsx
public/             CNAME, robots.txt, manifest, icons, og.png, img/*.png
```

Content lives in plain JS (`content.mjs`), not TS, so the generator runs
with bare Node and no `tsx`/`ts-node` dependency. Type safety is replaced by
a runtime shape check in `generate.mjs` (every language has every key of
`en`, arrays have equal length, no empty strings, no leftover
`{placeholder}`); `generate.test.ts` runs the same check under vitest.

### 4.2 Content model (`site/content.mjs`)

```js
export const LANGS = ['en', 'ru', 'de', 'pl', 'es'];
export const content = {
  en: {
    brand: 'Under Stairs Storage Planner',
    nav: { home, measure, faq, app },
    landing: {
      title, description,          // <title>, meta description (≤ 155 chars)
      h1, lead,                    // hero
      cta,                         // "Open the planner"
      features: [{ h, p }],        // 6 items
      how: [{ h, p }],             // 3 steps: measure → design → export
      screenshots: [{ src, alt }], // 2 images from /img/
      outputs: { h, p },           // what you get: 3D, drawings, PDF, cut list
      privacy: { h, p },           // runs in browser, no account
    },
    measure: {
      title, description, h1, lead,
      steps: [{ h, p }],           // length, tall height, low height, depth,
                                   // clearance, obstacles
      tips: [p],
    },
    faq: {
      title, description, h1,
      items: [{ q, a }],           // 10–12 items
    },
    footer: { source, issue, license, langs },
  },
  ru: {...}, de: {...}, pl: {...}, es: {...},
};
```

`a` in FAQ and `p` elsewhere may contain a small allowed subset of inline
HTML (`<a>`, `<strong>`, `<code>`). Everything else is escaped.

### 4.3 Template (`site/template.html`)

One file with `{{slots}}` filled by the generator:

- `<html lang="{{lang}}">`
- `<title>`, `<meta name="description">`, `<link rel="canonical">`
- `<link rel="alternate" hreflang="…">` for all 5 languages +
  `x-default` → EN URL of the same page
- OG: `og:title`, `og:description`, `og:url`, `og:image` (`/og.png`,
  1200×630), `og:type=website`, `og:locale` + `og:locale:alternate`;
  Twitter `summary_large_image`
- `<link rel="icon">` (svg + ico), `apple-touch-icon`, `manifest`,
  `theme-color`
- `{{verification}}`: `<meta name="google-site-verification">` when
  `SITE_GSC_TOKEN` env is set, else nothing
- `{{analytics}}`: Cloudflare Web Analytics beacon
  `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"…"}'>`
  when `SITE_CF_BEACON` env is set, else nothing
- `{{jsonld}}`: landing → `WebApplication` (name, url, applicationCategory
  `DesignApplication`, operatingSystem `Web`, offers price 0, inLanguage
  list); FAQ → `FAQPage` with every Q/A; measure page → `HowTo` with the
  steps
- header: brand link, nav (home / measure / FAQ), CTA button to
  `/app/?lang=…`
- `{{main}}`: page body
- footer: language switcher (links to the same page in each language),
  GitHub link, "Report an issue" (GitHub issues), MIT

The CI workflow passes `SITE_GSC_TOKEN` and `SITE_CF_BEACON` from repository
secrets/vars; locally they are unset and the tags are omitted.

### 4.4 Generator outputs

- One HTML file per page × language at the paths listed in 4.5
- `public/sitemap.xml`: every content URL with `xhtml:link` hreflang
  alternates, plus `/app/`; `lastmod` = build date
- `public/llms.txt`: plain-text summary of what the tool is, the page list,
  and the FAQ in English
- `robots.txt` is hand-written in `public/`: allow all, `Sitemap:` line

### 4.5 Vite and generated paths

The generator writes HTML into the paths Vite's multi-page build expects,
relative to the repo root, so `dist/` mirrors the URL structure 1:1 with no
path rewriting:

```
index.html                      EN landing
faq/index.html
how-to-measure/index.html
<lang>/index.html               ru, de, pl, es
<lang>/faq/index.html
<lang>/how-to-measure/index.html
public/sitemap.xml
public/llms.txt
```

All of these are gitignored (`/index.html`, `/faq/`, `/how-to-measure/`,
`/ru/`, `/de/`, `/pl/`, `/es/`, `/public/sitemap.xml`, `/public/llms.txt`).
`robots.txt` is hand-written in `public/` and committed.

- `vite.config.ts`: `build.rollupOptions.input` = glob of the generated
  HTML files plus `app/index.html`. Content pages link `/site/site.css`,
  the app page links `/src/main.tsx`; Vite hashes both.
- Scripts: `"site": "node site/generate.mjs"`, `"prebuild": "pnpm site"`,
  `"predev": "pnpm site"`. `pnpm build` keeps `tsc --noEmit && vite build`.
- `base` is always `'/'`; the `BASE_PATH` env is removed.
- `public/CNAME` = `understairsplanner.com`.
- `pnpm dev`: content pages at `http://localhost:5173/`, app at `/app/`.

### 4.6 CI

`.github/workflows/pages.yml`: drop `BASE_PATH`, add
`SITE_GSC_TOKEN: ${{ secrets.SITE_GSC_TOKEN }}` and
`SITE_CF_BEACON: ${{ secrets.SITE_CF_BEACON }}` to the build step (empty
until the user creates them; build must not fail when empty).

## 5. App changes

### 5.1 Languages

- `Lang = 'en' | 'ru' | 'de' | 'pl' | 'es'`; `LANGS` extended;
  `isLang` updated.
- New `src/i18n/de.ts`, `pl.ts`, `es.ts`, each `Record<MessageKey, string>`.
  `i18n.test.ts` parity test iterates `LANGS` instead of hardcoding ru.
- `detectLang(navLang)`: prefix match on `ru`, `de`, `pl`, `es`, else `en`.
- New `readLangFromUrl(search): Lang | null` in `src/i18n` (pure); `store.ts`
  bootstrap uses `readLangFromUrl(location.search) ?? loadLang(storage) ??
  detectLang(navigator.language)`, then `history.replaceState` to drop
  `?lang` and `saveLang` immediately so the choice sticks.
- TopBar language switcher: `<select>` instead of five buttons (keeps the
  mobile top bar narrow). Options labelled with native names
  (English, Русский, Deutsch, Polski, Español).
- `document.documentElement.lang` already follows `ui.lang`.

### 5.2 PDF font

PT Sans Regular covers Latin, Latin Extended-A (Polish ą ć ę ł ń ó ś ź ż,
Spanish ñ ¿ ¡, German ß ä ö ü) and Cyrillic. Add a test that, for each
non-EN dictionary, every character used is present in the TTF's cmap
(parse the `cmap` table with a ~40-line reader in the test, no dep). If a
glyph is missing the test names it, and we swap in the full PT Sans build.

### 5.3 Rename

- `index.html`→`app/index.html` `<title>`: "Under Stairs Storage Planner".
- `ui.appTitle` key (new) shown in TopBar in each language.
- README title/first paragraph, `package.json` name, CLAUDE.md, spec §1
  wording where it says "Under-stairs Closet Planner".
- Repo name on GitHub is unchanged (URL stability for the source link);
  README notes the rename.

### 5.4 Screenshots

`public/img/3d.png`, `public/img/front.png`, `public/img/pdf.png` and
`public/og.png` are captured manually from the running app at 1600 px wide
and committed. Not generated in CI.

## 6. Content

Written by the implementer in EN first, then translated. Facts must match
the app (feature list from README, real validation limits, mm units — the
imperial note says "imperial units coming"). Tone: plain, second person, no
marketing fluff.

FAQ topics (EN source, ~12): what it is / is it free / does it upload my
data / which stairs work (straight only) / what to measure / what
thickness & material / minimum drawer height / sloped vs stepped top /
what the PDF contains / can a joiner use the cut list / imperial units /
mobile support / how to report a bug.

How-to-measure steps: length along the wall, tall-end height, low-end
height (or 0), depth, clearance to the stair underside, note obstacles
(fuse box, radiator, pipes), photograph the space.

## 7. Testing

- `site/generate.test.ts`: content shape check passes; every lang × page
  renders; each rendered page contains canonical, 5 hreflang + x-default,
  og:image, exactly one `<h1>`, no `{{` or `{placeholder}` remnants;
  sitemap lists every URL; env-gated tags absent when env empty and present
  when set.
- `i18n.test.ts`: parity across 5 dictionaries; `detectLang` and
  `readLangFromUrl` cases.
- `pdf/font.test.ts`: glyph coverage per dictionary.
- `pnpm build` output includes `dist/index.html`, `dist/app/index.html`,
  `dist/es/faq/index.html`, `dist/sitemap.xml`, `dist/CNAME`.
- Manual: Lighthouse SEO ≥ 95 on landing; Rich Results test passes for
  FAQ and WebApplication.

## 8. Rollout (user actions)

1. Register `understairsplanner.com` (Porkbun), set DNS: `A` records to
   GitHub Pages IPs + `CNAME www → bynov.github.io`; enable HTTPS in repo
   Pages settings after DNS propagates.
2. Create Cloudflare Web Analytics site → token → repo secret
   `SITE_CF_BEACON`.
3. Search Console: add domain property, get HTML-tag token → secret
   `SITE_GSC_TOKEN`; submit `/sitemap.xml`.
4. Merge; verify Pages deploy serves the custom domain.
