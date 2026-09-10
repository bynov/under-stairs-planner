# Under Stairs Storage Planner

**Live: https://understairsplanner.com/** (app at `/app/`)

A browser-based planner for a fitted cabinet in the triangular space under a
staircase. Describe the closet and the cabinet columns; get an interactive 3D
model, dimensioned 2D drawings, and a multi-page PDF scheme with a cut list
you can hand to a joiner. Runs entirely in the browser — no account, no
server; your project autosaves locally and can be exported as JSON.

Formerly "Under-stairs Closet Planner"; the GitHub repo keeps its old name.

UI, drawings and PDF in English, Russian, German, Polish and Spanish.

## Features

- **Envelope** — length, max/min height, depth, tall side, clearance to the stair underside
- **Cabinet** — depth, panel/back thickness, plinth, sloped or stepped top
- **Columns** — width, shelves or drawers, optional door, hanging rod; free-width hint when adding
  - drawers behind a door are built as internal drawers; open drawers under a sloped top get an open shelf in the triangle above
- **3D view** — orbit/zoom, dimension labels, envelope toggle, explode slider (drawer boxes pull out with their fronts)
- **2D views** — front elevation, plan, side section, with dimensions; hidden parts behind doors drawn dashed
- **Cut list** — grouped parts with sizes, thickness, material and notes (bevel angles, trapezoid heights)
- **PDF** — summary with 3D snapshot, all views, one detail page per column, paginated cut list, standard scales (1:10, 1:20, …)
- **Validation** — live checks (column fits under the slope, cabinet fits the niche, drawer heights); the last valid design stays rendered while you type
- **Persistence** — localStorage autosave, JSON import/export (older files migrate automatically)
- Works on phones: single-column layout with an Edit panel

## Conventions

All lengths are millimetres. `x` runs along the stair (0 at the tall end),
`y` is up, `z` goes into the closet from the front opening. Every part is an
outline polygon extruded to its thickness and placed with one transform; the
3D model, the drawings and the cut list are all derived from that same list of
parts, so they cannot disagree.

## Develop

```bash
pnpm install
pnpm site       # regenerate landing pages (runs automatically before dev/build)
pnpm dev        # http://localhost:5173
pnpm test       # vitest (geometry, drawings, PDF, store)
pnpm typecheck
pnpm build      # dist/
```

Stack: Vite, React 18, TypeScript (strict), three.js / react-three-fiber /
drei, zustand, jsPDF, vitest.

```
src/model      types, defaults, validation
src/geometry   envelope math, column layout, Part[] builder, drawer boxes (3D only)
src/cutlist    grouping into cut-list rows
src/drawing    drawing IR with dimensions; front / plan / side / column-detail views
src/render     SVG and PDF renderers for the drawing IR
src/pdf        multi-page PDF document (embeds PT Sans for Cyrillic)
src/i18n       EN / RU dictionaries and t()
src/store      zustand store, autosave, JSON import/export and migrations
src/ui         React components; 3D viewport under src/ui/three
site/          static landing / guide / FAQ pages, 5 languages, generated at build
```

Design notes live in `docs/superpowers/specs/`.

## Deploy

Every push to `main` builds and publishes to GitHub Pages via
`.github/workflows/pages.yml`. The custom domain is configured in GitHub →
Settings → Pages (see rollout checklist below); `public/CNAME` is kept in the
artifact for consistency. Pages source: GitHub Actions.

### Custom domain rollout (one-time)

1. Register `understairsplanner.com`; DNS: `A` 185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153, `CNAME www → bynov.github.io`.
2. GitHub → Settings → Pages → Custom domain `understairsplanner.com`, tick Enforce HTTPS once DNS resolves.
3. Cloudflare Web Analytics → add site → copy token → repo secret `SITE_CF_BEACON`.
4. Google Search Console → domain property → HTML-tag token → repo secret `SITE_GSC_TOKEN`; submit `https://understairsplanner.com/sitemap.xml`.
5. Push to `main`; verify `https://understairsplanner.com/` and `/app/`.

## License

MIT — see `LICENSE`.

## Credits

PDF text uses [PT Sans](https://company.paratype.com/pt-sans-pt-serif)
(SIL Open Font License, see `src/pdf/fonts/OFL.txt`).
