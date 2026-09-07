# Under-Stairs Closet Planner — Design Spec

Date: 2026-09-07
Status: implemented 2026-09-07; amended 2026-09-07 for i18n (EN/RU) and column interior/door model (v2)

## 1. Goal

A browser-based, locally-run 3D planner for a fitted cabinet inside an
under-stairs (triangular-prism) closet. The user defines the closet envelope
and the cabinet's columns; the tool shows the cabinet in 3D and in dimensioned
2D views, and exports a multi-page PDF scheme (views, per-column details, cut
list) suitable for building the cabinet.

Non-goals (v1): pricing, hardware catalogues, curved/custom shapes, end-access
closets, cloud storage, mobile layout.

Languages: English and Russian (UI, drawings, cut list, PDF). See §2.6.

## 2. Domain model

All lengths are millimetres (integers or decimals). Coordinate system:

- X: along the stair run. `x = 0` at the **tall** end of the envelope.
- Y: up. `y = 0` at the floor.
- Z: depth into the closet. `z = 0` at the front opening plane.

The opening is on the long sloped side (the classic drawers/doors-in-columns
under-stairs cabinet). `tallSide` only mirrors X for display.

### 2.1 Envelope

```ts
interface Envelope {
  length: number;      // along X
  heightMax: number;   // ceiling height at x = 0
  heightMin: number;   // ceiling height at x = length (knee wall); may be 0
  depth: number;       // along Z
  tallSide: 'left' | 'right';  // display mirroring only
  topClearance: number;        // gap between cabinet top and stair underside
}
```

Ceiling height at x: `ceilY(x) = heightMax - (heightMax - heightMin) * x / length`.
Slope angle from horizontal: `theta = atan((heightMax - heightMin) / length)`.

### 2.2 Cabinet

```ts
interface Cabinet {
  panelThickness: number;   // default 18
  backThickness: number;    // default 4
  plinthHeight: number;     // default 100
  depth: number;            // cabinet depth, <= envelope.depth - gapBack
  gapBack: number;          // minimum gap between cabinet back and back wall; cabinet front stays at z = 0
  topStyle: 'sloped' | 'stepped';
  columns: Column[];
}

interface Column {
  id: string;
  width: number;                       // outer width along X
  interior: 'shelves' | 'drawers';     // mutually exclusive contents
  shelves: number;                     // when interior = shelves; 0 = empty
  drawerCount: number;                 // when interior = drawers, >= 1
  door: boolean;                       // a door in front of the contents
  rod: boolean;                        // hanging rail; only when interior = shelves
}
```

Columns are placed left-to-right from `x = 0` (tall end), each a separate
carcass sharing no panels (simple: every column has two sides, top, bottom,
back). Column `i` occupies `[x0, x1]` with `x0 = sum(width[0..i-1])`.

### 2.3 Derived heights

For column at `[x0, x1]`:

- `hTall = ceilY(x0) - topClearance`, `hLow = ceilY(x1) - topClearance`.
- `topStyle === 'sloped'`: carcass top follows the slope between `hTall` and
  `hLow`. The slope runs along X, so a side panel (YZ plane) has constant
  height and is a **rectangle**: each side is cut to the long point of its
  bevelled top edge: left side `ceilTop(x0) - panelThickness / cos(theta)`,
  right side `ceilTop(x1 - panelThickness) - panelThickness / cos(theta)`,
  where `ceilTop(x)` is the outer cabinet top height at x, measured from the
  plinth top; both top edges bevelled at `theta` (cut-list note; 3D shows a
  plain rectangle). Top panel is a rectangle of length
  `(x1 - x0) / cos(theta)` (measured along the slope) x cabinet depth, with
  its two end edges (the ones meeting the sides) bevelled at `theta`
  (cut-list note; 3D shows the rotated box). Back panel and fronts are
  trapezoids.
- `topStyle === 'stepped'`: carcass top is horizontal at `hLow`. Sides are
  equal rectangles; back panel and fronts are rectangles.

Carcass sits on the plinth: bottom panel underside at `y = plinthHeight`.

### 2.4 Column contents

- Interior zone: between bottom panel top and top panel underside, between
  the side panels, depth = cabinet depth − back thickness.
- **Shelves** (`interior = shelves`): `shelves` fixed shelves at equal
  vertical pitch within the interior height measured at the column's lower
  side (`hLow`), so every shelf fits under the slope: pitch = interior
  height / (shelves + 1). Shelf depth = interior depth − 20 mm setback.
- **Drawers** (`interior = drawers`): `drawerCount` drawer fronts of equal
  height stacked from the bottom with 3 mm gaps between fronts. Two builds:
  - *Overlay* (`door = false`): fronts span the column width minus a 2 mm
    reveal at the edges and sit in front of the carcass (z −t..0). Under a
    `sloped` top the triangular space above `hLow` stays **open** as a
    single shelf: a fixed shelf board (`nameKey: shelf`, standard 20 mm
    setback) with its top surface at the interior height of the low side
    (`floorY + interiorHeight`, the top panel's underside at the inner face
    of the right side, `t/cosθ − t·tanθ` below `hLow`); the drawer zone
    runs from the carcass underside up to the shelf's underside minus the
    reveal. Under a `stepped` top there is no triangle: no top
    shelf, and the zone runs up to `hLow − 2`. There is no fixed front
    panel.
  - *Internal* (`door = true`): fronts sit inside the carcass, flush with
    its front edge (z 0..t), spanning the interior width minus a 3 mm gap
    each side, filling the interior height at the low side minus 3 mm top
    and bottom. No fixed front panel; the door covers the opening.
  Drawer boxes are not modelled beyond the front (cut list lists fronts
  only; box parts are out of scope for v1).
- **Door** (`door = true`, any interior): one door covering the whole
  column front; outline is the column's front outline (trapezoid when
  sloped, rectangle when stepped), minus a 2 mm reveal on all sides.
- **Rod**: 25 mm diameter rail across the column at `hLow - 200 mm`,
  set 250 mm back from the front. Only when `interior = shelves`
  (`rod` is ignored for drawers). No collision check against shelves in v1.
- Plinth: one plinth board per column, height `plinthHeight`, set back 40 mm.

### 2.5 Validation

Model is validated on every change; errors are displayed and the last valid
model stays rendered. Rules:

- `length, heightMax, depth > 0`; `0 <= heightMin < heightMax`.
- `cabinet.depth + gapBack <= envelope.depth`; `cabinet.depth >= 200`.
- Sum of column widths `<= envelope.length`.
- Every column: `width >= 2*panelThickness + 100`,
  `hLow >= plinthHeight + 2*panelThickness + 100`.
- `drawerCount >= 1` when `interior === 'drawers'`; shelves `>= 0`.

### 2.6 Internationalisation

Two languages, `Lang = 'en' | 'ru'`. All user-visible strings come from typed
dictionaries in `src/i18n/` (`en.ts` defines the key set, `ru.ts` must match it)
through a pure `t(lang, key, params?)` with `{name}` interpolation. Data that
carries text (part names, part notes, validation errors, import errors, toasts)
carries a `Msg = { key, params? }` instead of a string and is translated at
render time. Views and the PDF take `lang` as a parameter. The language lives
in `ui.lang`, persisted separately from the project (`localStorage`
`understairs-planner:lang`), defaulting from `navigator.language` (`ru*` → ru).
The top bar has an `EN | RU` switch. Numbers keep a dot decimal separator.

## 3. Architecture

Single-page app. Pure TypeScript core with no DOM dependency, thin React UI
around it. Everything downstream derives from one `Part[]`.

```
model/     types, defaults, validate(model) -> ValidationError[]
geometry/  envelope math; buildParts(model) -> Part[]
cutlist/   buildCutList(parts) -> CutRow[]
drawing/   views: frontView, planView, sideView, columnDetail -> Drawing (IR)
render/    drawingToSvg(drawing), drawingToPdf(doc, drawing, box)
pdf/       exportPdf(model, snapshotPng) -> Blob
store/     zustand store, localStorage autosave, JSON import/export
ui/        React components: Sidebar forms, Viewport3D, View2D, CutListTable
```

### 3.1 Part

```ts
interface Part {
  id: string;
  columnIndex: number | null;   // null for plinth/global parts
  nameKey: 'sideL' | 'sideR' | 'top' | 'bottom' | 'back' | 'shelf' | 'door'
         | 'drawerFront' | 'plinth' | 'rod';   // translated via i18n key `part.<nameKey>`
  index?: number;               // 1-based for repeated parts (shelf, drawerFront)
  kind: 'side' | 'top' | 'bottom' | 'back' | 'shelf' | 'door' | 'drawerFront'
      | 'plinth' | 'rod';
  outline: Vec2[];              // polygon in the part's local XY plane, mm
  thickness: number;            // extrusion along local Z
  transform: { position: Vec3; rotation: Vec3 }; // Euler XYZ, radians
  material: 'panel' | 'back' | 'rod';
  notes?: Msg[];                // e.g. { key: 'note.bevelTopEdge', params: { deg: 35.2 } }
}
```

Sides: local XY = the YZ rectangle (depth x height), extruded along X. Top/bottom/shelves: local
XY = plan rectangle, extruded along Y (top rotated by `theta` when sloped).
Fronts/back: local XY = elevation outline, extruded along Z.

### 3.2 Drawing IR

```ts
type Prim =
  | { t: 'line'; a: Vec2; b: Vec2; stroke?: 'thin' | 'thick' | 'dashed' }
  | { t: 'poly'; pts: Vec2[]; closed: boolean; stroke?: ...; fill?: 'panel' | 'none' }
  | { t: 'text'; at: Vec2; text: string; size?: number; anchor?: 'start'|'middle'|'end'; rotate?: number }
  | { t: 'dim'; a: Vec2; b: Vec2; offset: number; label?: string }; // linear dimension
interface Drawing { title: string; prims: Prim[]; bounds: Box2 }
```

Coordinates are model mm in a Y-up plane; renderers flip Y. `dim` is expanded
into lines/arrows/text by a shared helper so SVG and PDF look identical.

Views:
- **Front elevation** (XY, looking at −Z): envelope outline (dashed), every
  front-facing part; contents hidden behind a door (shelves, rod, internal
  drawer fronts) are drawn as dashed hidden lines; the open top shelf above
  overlay drawers is drawn solid; dims: total length, each column width, height at every
  column boundary (tall and low), plinth height, slope angle text.
- **Plan** (XZ, looking down): envelope, carcass outlines, dims: total
  length, cabinet depth, envelope depth, gapBack, column widths.
- **Side section** (YZ at the tall end): envelope section (rectangle
  `depth` x `heightMax` at x = 0, back wall dashed), first column section
  with shelves/plinth/rod, dims: heights, depth, gapBack, plinth.
- **Column detail** (per column): front + section side-by-side with
  internal dims (interior width/height, shelf pitch, drawer front heights,
  rod height).

### 3.3 Renderers

- SVG: `Drawing -> string` with a viewBox from bounds; used in the 2D tabs.
- PDF: jsPDF, A4 landscape, drawing scaled to fit a content box, scale
  ratio printed as `1:N` (N rounded up to a standard: 5,10,20,25,50,100).
  Embedded PT Sans Regular (OFL, Cyrillic + Latin) for all text in both
  languages; `°` and `Ø` allowed.

### 3.4 PDF document

1. Summary: project name, date, envelope & cabinet parameters table, 3D
   snapshot (PNG from the WebGL canvas, `preserveDrawingBuffer: true`).
2. Front elevation.  3. Plan.  4. Side section.
5. One page per column: column detail.
6. Cut list table (auto-paginated): #, name, column, qty, length, width,
   thickness, material, notes.

Cut list rows are grouped by identical (nameKey, kind, dims, notes) with qty; names translated at render time.

### 3.5 3D viewport

react-three-fiber + drei `OrbitControls`. Each `Part` becomes a mesh:
`ExtrudeGeometry` from the outline (`Shape`) with depth = thickness, placed
with its transform. Rod uses a cylinder. Envelope drawn as a translucent
stair-underside plane + floor + back wall edges. Toggles: dimension labels
(drei `Html`/text for key dims), explode (offset parts outward along Z / Y
by a factor), envelope visibility. Camera fits to envelope bounds on load.

### 3.6 State & persistence

zustand store holds `{ project: { name, envelope, cabinet }, ui: {...} }`.
Autosave `project` to `localStorage` (debounced). Toolbar: New (defaults),
Export JSON (download), Import JSON (file input), Export PDF. JSON files carry
`version`; version 1 files (with `front: 'none' | 'door' | 'drawers'`) are
migrated on read: `none` → shelves/no door, `door` → shelves/door,
`drawers` → drawers/no door. Current version: 2. Defaults are a
plausible sample (length 2600, heightMax 2200, heightMin 900, depth 900,
four columns: shelves+door+rod, 3 shelves+door, overlay drawers ×4, internal
drawers ×3 behind a door) so the app opens with something to look at.

## 4. UI layout

- Top bar: project name input, tab switch (3D | Front | Plan | Side | Cut list),
  New / Import / Export JSON / Export PDF buttons, `EN | RU` language switch.
- Left sidebar (320 px, scrollable): Envelope section, Cabinet section,
  Columns list — each column is a card with width / interior (shelves or
  drawers) / count / door / rod and left/right/remove buttons; "Add column"
  appends a 500 mm shelves+door column if it fits (else the remaining width
  if it is at least the minimum column width). A read-only line next to the
  button shows the free width remaining (`envelope.length − Σ widths`), and
  the button is disabled when nothing fits. A read-only line under each card
  shows derived `hTall/hLow`.
- Validation errors listed at the top of the sidebar in red.
- Centre: the active tab content fills remaining space.

## 5. Error handling

- Invalid input never throws to the UI: `validate()` returns errors; the
  renderers receive the last valid model.
- PDF export shows a spinner and a toast on failure; snapshot failure
  (e.g. no WebGL) falls back to a page without the image.
- JSON import validates shape (version field + `validate()`); on failure a
  toast explains and nothing changes.

## 6. Testing

- vitest unit tests for `geometry` (ceilY, theta, column ranges, trapezoid
  side outlines, sloped top length, drawer heights, shelf pitch), `validate`,
  `cutlist` (grouping, notes), `drawing` (each view has expected dims and
  bounds), `render/svg` (well-formed, contains dims), `pdf` (page count =
  4 + columns + cut-list pages, runs in node via jsPDF).
- UI verified manually via `pnpm dev`; typecheck (`tsc --noEmit`) and
  `pnpm build` must pass.

## 7. Stack

Vite, TypeScript (strict), React 18, three + @react-three/fiber + @react-three/drei,
zustand, jsPDF, vitest. Package manager: pnpm. Scripts: `dev`, `build`,
`test`, `typecheck`.
