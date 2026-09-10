# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm only (lockfile + `pnpm-workspace.yaml`; CI uses pnpm 11 / Node 22).

```bash
pnpm install
pnpm site                     # regenerate landing pages (runs automatically before dev/build)
pnpm dev                      # Vite dev server, http://localhost:5173
pnpm test                     # vitest run (all src/**/*.test.ts, node environment)
pnpm vitest run src/geometry/column.test.ts     # single file
pnpm vitest run -t "trapezoid"                  # by test name
pnpm typecheck                # tsc --noEmit (strict)
pnpm build                    # typecheck + vite build -> dist/
pnpm embed-font               # regenerate src/pdf/fonts/ptsans.ts from the TTF (only if the font changes)
```

CI (`.github/workflows/pages.yml`) runs `pnpm test` then `pnpm build` (with `SITE_GSC_TOKEN` / `SITE_CF_BEACON` secrets, empty allowed) and deploys `dist/` to GitHub Pages on every push to `main`. The custom domain is configured in GitHub → Settings → Pages (see the rollout checklist in README.md); `public/CNAME` is kept in the artifact for consistency. Keep both green before pushing.

Tests run in a `node` environment: no DOM, no WebGL. This covers both `src/**/*.test.ts` and `site/**/*.test.ts`. Anything under `src/ui` is untested by design; keep logic out of components and in the pure modules so it can be tested.

## Architecture: one Part list, many outputs

The core invariant: `buildParts(project)` in `src/geometry/parts.ts` produces a flat `Part[]`, and every output is derived from it or from the same `layoutColumns()` data, so 3D, drawings and cut list can never disagree.

```
Project (src/model/types.ts)
  └─ validate()                      src/model/validate.ts
  └─ columnRanges() / slopeAngle()   src/geometry/envelope.ts   x-ranges, top heights per column
      └─ layoutColumns()             src/geometry/column.ts     ColumnLayout: side heights, shelves, door outline, drawer fronts, rod
          ├─ buildParts()            src/geometry/parts.ts      Part[] = outline polygon + thickness + transform + notes
          │    ├─ buildCutList()     src/cutlist/cutlist.ts     groups identical parts into CutRow[]
          │    └─ PartMesh           src/ui/three/PartMesh.tsx  extrudes each Part in three.js
          ├─ drawerBoxes()           src/geometry/drawerBox.ts  3D-only visual boxes, NOT Parts, not in cut list
          └─ frontView/planView/sideView/columnDetail   src/drawing/views.ts, column.ts
               └─ Drawing IR (src/drawing/ir.ts: line/poly/text/dim prims)
                    ├─ src/render/svg.ts   -> on-screen 2D tabs
                    └─ src/render/pdf.ts   -> jsPDF, standard 1:N scales
                         └─ src/pdf/exportPdf.ts  multi-page A4 landscape document
```

Conventions that everything relies on:
- All lengths in mm. `x` along the stair, 0 at the tall end; `y` up from the floor; `z` into the closet from the front opening. `envelope.tallSide` is display-only mirroring (`mirrorX` in drawing IR), never geometry.
- A `Part` is a local-XY polygon extruded along local +Z by `thickness`, placed by a single `{position, rotation}` transform (`src/geometry/vec.ts` has the rotation constants `FLAT_ROT`, `SIDE_ROT`, `NO_ROT`, `ROD_ROT`). Add new cabinet parts by adding to `buildParts`; the cut list and 3D pick them up automatically. Drawings do not: they draw from `ColumnLayout` via `columnFrontPrims`/`columnSectionPrims`.
- Sloped top: top panel is one rotated rect (`w / cos θ`), side and back panels are trapezoids, and bevel/trapezoid notes are attached as `Msg[]` on the Part so they flow to the cut list and PDF.
- Drawing `dim` prims are expanded lazily (`expandPrims`/`expandDim`) at render time; bounds are computed including text extents.

## Static site

`site/generate.mjs` renders `site/template.html` × `site/content.mjs` into repo-root HTML (`index.html`, `faq/`, `how-to-measure/`, `<lang>/…`) that Vite's MPA build copies 1:1 to `dist/`. Those paths are gitignored; edit `site/content.mjs`, never the output. The app lives at `app/index.html` → `/app/`. Env `SITE_GSC_TOKEN` / `SITE_CF_BEACON` gate the Search Console meta and Cloudflare beacon.

## State and validation

`src/store/store.ts` is a zustand store created by `createPlannerStore()` (factory, so tests can build one with a fake storage). It keeps both `project` (what the user is typing, may be invalid) and `lastValid`. Rule: editing UI (`Sidebar`, `ColumnCard`, `TopBar` inputs) reads `project`; every renderer (`Viewport3D`, `View2D`, `CutListTable`, PDF export) reads `lastValid`. `errors` from `validate()` are shown live. Do not make a renderer read `project`.

Autosave: `startAutosave` debounces `project` changes into localStorage under `STORAGE_KEY`. Restore uses `parseProjectShape` (shape-check only, so an invalid draft survives reload), while file import uses `parseProjectJson` (shape + `validate()`). `FILE_VERSION` in `src/store/persist.ts` is the JSON file version; a schema change to `Project` means bumping it and extending `migrateProject`, plus `isProjectShape`.

## i18n

Every user-facing string is a key in `src/i18n/en.ts`; `ru.ts` is typed as `Record<MessageKey, string>` and a test asserts identical key sets, so adding a string means adding it to both files. Pure modules (geometry, cutlist, validate, persist) never call `t()`; they return `Msg` objects (`msg(key, params)`) and the UI/PDF translate them with `tm(lang, msg)` or the `useT()` hook. Drawing views and PDF take `lang` explicitly because they produce text.

PDF text embeds PT Sans (base64 in `src/pdf/fonts/ptsans.ts`, generated, do not edit) so Cyrillic renders; `registerPdfFont(doc)` must be called on every new `jsPDF`.

## 3D viewport

`src/ui/three/Viewport3D.tsx` (react-three-fiber + drei). The PDF summary page's 3D snapshot comes from `src/ui/snapshot.ts`: the viewport registers a `canvas.toDataURL` snapshotter while mounted, so the PDF only gets a picture if the 3D tab is open. The explode slider offsets parts by kind (`explodeOffset` in `PartMesh.tsx`) and pulls drawer boxes out with their fronts.

## Design docs

`docs/superpowers/specs/2026-09-07-understairs-closet-planner-design.md` is the domain spec (envelope, column layout rules, drawer/door/rod semantics, validation rules). Read it before changing layout math; implementation plans live in `docs/superpowers/plans/`.
