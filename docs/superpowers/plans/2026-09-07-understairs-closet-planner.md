# Under-Stairs Closet Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-based, locally-run planner that turns an under-stairs closet envelope plus a list of cabinet columns into a 3D view, dimensioned 2D views, and a multi-page PDF scheme with a cut list.

**Architecture:** Pure TypeScript core (`model` → `geometry` → `Part[]` → `cutlist` / `drawing` IR → `render` SVG/PDF) with no DOM dependency, unit-tested with vitest. A thin React shell (zustand store, sidebar forms, react-three-fiber viewport, SVG tabs, jsPDF export) sits on top and is verified manually.

**Tech Stack:** Vite, TypeScript (strict), React 18, three + @react-three/fiber 8 + @react-three/drei 9, zustand, jsPDF, vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-07-understairs-closet-planner-design.md`

## Global Constraints

- All lengths are millimetres. Coordinates: X along the stair run (`x = 0` at the tall end), Y up (`y = 0` floor), Z depth into the closet (`z = 0` front opening plane).
- `ceilY(x) = heightMax - (heightMax - heightMin) * x / length`; `theta = atan((heightMax - heightMin) / length)`.
- Defaults: `panelThickness 18`, `backThickness 4`, `plinthHeight 100`. Reveal 2 mm, drawer gap 3 mm, shelf setback 20 mm, rod Ø25 at `hLow - 200`, 250 mm back from front, plinth set back 40 mm.
- Validation rules from spec §2.5 (copied verbatim into Task 2).
- Every `Part` is an outline polygon in its local XY plane extruded along local +Z by `thickness`, then transformed. Transform = rotate about world X, then world Y, then world Z, then translate. The 3D viewport builds its matrix as `Rz * Ry * Rx` to match.
- PDF: A4 landscape, Helvetica, ASCII labels only, scale `1:N` with N from `[1, 2, 5, 10, 20, 25, 50, 100, 200]`.
- Pages: summary, front, plan, side, one per column, cut list (paginated).
- Package manager pnpm. Scripts `dev`, `build`, `test`, `typecheck`. `pnpm typecheck && pnpm test && pnpm build` must pass at the end of every task that touches `src/`.
- Non-goals: pricing, hardware, curved shapes, end-access closets, i18n, cloud, mobile.

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html
src/main.tsx                  React entry
src/App.tsx                   layout shell: TopBar + Sidebar + content by tab
src/styles.css
src/model/types.ts            Envelope, Column, Cabinet, Project, ValidationError
src/model/defaults.ts         defaultProject(), defaultColumn(), newColumnId()
src/model/validate.ts         validate(project) -> ValidationError[]
src/geometry/vec.ts           Vec2/Vec3/Box2/Box3/Transform, rotX/Y/Z, toWorld, bounds2/3
src/geometry/envelope.ts      ceilY, slopeAngle, columnRanges
src/geometry/column.ts        constants, ColumnLayout, layoutColumn(s)
src/geometry/parts.ts         Part, buildParts, partBounds, rect, circle
src/cutlist/cutlist.ts        CutRow, partDims, buildCutList
src/drawing/ir.ts             Prim, Drawing, prim helpers, makeDrawing, expandPrims, mirrorX, textSizeFor
src/drawing/dim.ts            expandDim, fmtLen
src/drawing/column.ts         columnFrontPrims, columnSectionPrims (shared by views)
src/drawing/views.ts          frontView, planView, sideView, columnDetail
src/render/svg.ts             drawingToSvg
src/render/pdf.ts             pickScale, drawingToPdf
src/pdf/exportPdf.ts          buildPdf, exportPdfBlob
src/store/persist.ts          serializeProject, parseProjectJson, load/saveToStorage, startAutosave
src/store/store.ts            zustand store + actions
src/ui/fields.tsx             NumberField, SelectField, CheckField
src/ui/TopBar.tsx             name, tabs, New/Import/Export JSON/Export PDF
src/ui/Sidebar.tsx            errors + EnvelopeForm + CabinetForm + ColumnsList
src/ui/ColumnCard.tsx
src/ui/View2D.tsx             SVG tab
src/ui/CutListTable.tsx
src/ui/Toast.tsx
src/ui/download.ts            downloadBlob
src/ui/snapshot.ts            setSnapshotter/takeSnapshot
src/ui/three/Viewport3D.tsx   Canvas, lights, controls, toggles
src/ui/three/PartMesh.tsx
src/ui/three/EnvelopeMesh.tsx
Tests live next to sources as *.test.ts.
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `.gitignore`

**Interfaces:**
- Produces: working `pnpm dev`, `pnpm build`, `pnpm test` (passes with no tests), `pnpm typecheck`.

- [ ] **Step 1: Create package.json and install dependencies**

```json
{
  "name": "understairs-planner",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

Run:
```bash
pnpm add react@18 react-dom@18 three @react-three/fiber@8 @react-three/drei@9 zustand jspdf
pnpm add -D typescript vite @vitejs/plugin-react vitest @types/react@18 @types/react-dom@18 @types/three
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Write vite.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 4: Write index.html, src/main.tsx, src/App.tsx, src/styles.css, .gitignore**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Under-stairs Planner</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx` (placeholder, replaced in Task 12):
```tsx
export function App() {
  return <div className="app">Under-stairs planner</div>;
}
```

`src/styles.css`:
```css
:root { font-family: system-ui, sans-serif; font-size: 14px; color: #222; }
body { margin: 0; }
```

`.gitignore`:
```
node_modules
dist
```

- [ ] **Step 5: Verify scripts**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all succeed; vitest prints "No test files found" and exits 0; `dist/` created.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react + ts project"
```

---

### Task 2: Model types, defaults, validation

**Files:**
- Create: `src/model/types.ts`, `src/model/defaults.ts`, `src/model/validate.ts`, `src/geometry/envelope.ts`
- Test: `src/model/validate.test.ts`, `src/geometry/envelope.test.ts`

**Interfaces:**
- Produces:
  - `Envelope`, `Column`, `Cabinet`, `Project`, `ValidationError`, `TopStyle`, `FrontKind`, `TallSide`
  - `defaultProject(): Project`, `defaultColumn(width?: number): Column`, `newColumnId(): string`
  - `validate(p: Project): ValidationError[]`
  - `ceilY(env: Envelope, x: number): number`, `slopeAngle(env: Envelope): number`
  - `columnRanges(p: Project): ColumnRange[]` with `ColumnRange = { index, column, x0, x1, width, hTall, hLow }`

- [ ] **Step 1: Write src/model/types.ts**

```ts
export type TallSide = 'left' | 'right';
export type TopStyle = 'sloped' | 'stepped';
export type FrontKind = 'none' | 'door' | 'drawers';

export interface Envelope {
  length: number;      // along X
  heightMax: number;   // ceiling height at x = 0
  heightMin: number;   // ceiling height at x = length; may be 0
  depth: number;       // along Z
  tallSide: TallSide;  // display mirroring only
  topClearance: number;
}

export interface Column {
  id: string;
  width: number;
  front: FrontKind;
  shelves: number;
  drawerCount: number;
  rod: boolean;
}

export interface Cabinet {
  panelThickness: number;
  backThickness: number;
  plinthHeight: number;
  depth: number;
  gapBack: number;
  topStyle: TopStyle;
  columns: Column[];
}

export interface Project {
  name: string;
  envelope: Envelope;
  cabinet: Cabinet;
}

export interface ValidationError {
  path: string;
  message: string;
}
```

- [ ] **Step 2: Write src/model/defaults.ts**

```ts
import type { Column, Project } from './types';

let seq = 0;
export function newColumnId(): string {
  seq += 1;
  return `c${Date.now().toString(36)}-${seq}`;
}

export function defaultColumn(width = 500): Column {
  return { id: newColumnId(), width, front: 'door', shelves: 0, drawerCount: 3, rod: false };
}

export function defaultProject(): Project {
  return {
    name: 'Under-stairs cabinet',
    envelope: { length: 2600, heightMax: 2200, heightMin: 900, depth: 900, tallSide: 'left', topClearance: 20 },
    cabinet: {
      panelThickness: 18,
      backThickness: 4,
      plinthHeight: 100,
      depth: 600,
      gapBack: 20,
      topStyle: 'sloped',
      columns: [
        { ...defaultColumn(700), front: 'door', rod: true },
        { ...defaultColumn(600), front: 'door', shelves: 3 },
        { ...defaultColumn(600), front: 'drawers', drawerCount: 4 },
        { ...defaultColumn(600), front: 'drawers', drawerCount: 3 },
      ],
    },
  };
}
```

- [ ] **Step 3: Write failing test src/geometry/envelope.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { ceilY, slopeAngle, columnRanges } from './envelope';
import { defaultProject } from '../model/defaults';

describe('envelope math', () => {
  const p = defaultProject();
  it('interpolates ceiling height', () => {
    expect(ceilY(p.envelope, 0)).toBe(2200);
    expect(ceilY(p.envelope, 2600)).toBe(900);
    expect(ceilY(p.envelope, 1300)).toBe(1550);
  });
  it('computes slope angle', () => {
    expect(slopeAngle(p.envelope)).toBeCloseTo(Math.atan(0.5), 10);
  });
  it('computes column ranges and heights', () => {
    const r = columnRanges(p);
    expect(r.map((c) => [c.x0, c.x1])).toEqual([[0, 700], [700, 1300], [1300, 1900], [1900, 2500]]);
    expect(r[0].hTall).toBe(2180);
    expect(r[0].hLow).toBe(1830);
    expect(r[3].hLow).toBe(930);
    expect(r[1].width).toBe(600);
    expect(r[1].index).toBe(1);
    expect(r[1].column.id).toBe(p.cabinet.columns[1].id);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run src/geometry/envelope.test.ts`
Expected: FAIL, cannot resolve `./envelope`.

- [ ] **Step 5: Write src/geometry/envelope.ts**

```ts
import type { Column, Envelope, Project } from '../model/types';

export function ceilY(env: Envelope, x: number): number {
  return env.heightMax - ((env.heightMax - env.heightMin) * x) / env.length;
}

export function slopeAngle(env: Envelope): number {
  return Math.atan((env.heightMax - env.heightMin) / env.length);
}

export interface ColumnRange {
  index: number;
  column: Column;
  x0: number;
  x1: number;
  width: number;
  hTall: number; // outer cabinet top height at x0
  hLow: number;  // outer cabinet top height at x1
}

export function columnRanges(p: Project): ColumnRange[] {
  const { envelope: env, cabinet } = p;
  let x = 0;
  return cabinet.columns.map((column, index) => {
    const x0 = x;
    const x1 = x + column.width;
    x = x1;
    return {
      index,
      column,
      x0,
      x1,
      width: column.width,
      hTall: ceilY(env, x0) - env.topClearance,
      hLow: ceilY(env, x1) - env.topClearance,
    };
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/geometry/envelope.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Write failing test src/model/validate.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { validate } from './validate';
import { defaultProject } from './defaults';

const paths = (p: ReturnType<typeof defaultProject>) => validate(p).map((e) => e.path);

describe('validate', () => {
  it('accepts the default project', () => {
    expect(validate(defaultProject())).toEqual([]);
  });
  it('rejects heightMin >= heightMax', () => {
    const p = defaultProject();
    p.envelope.heightMin = 2200;
    expect(paths(p)).toContain('envelope.heightMin');
  });
  it('rejects cabinet deeper than envelope allows', () => {
    const p = defaultProject();
    p.cabinet.depth = 900;
    expect(paths(p)).toContain('cabinet.depth');
  });
  it('rejects columns wider than the envelope', () => {
    const p = defaultProject();
    p.cabinet.columns[0].width = 3000;
    expect(paths(p)).toContain('cabinet.columns');
  });
  it('rejects a column that is too narrow', () => {
    const p = defaultProject();
    p.cabinet.columns[1].width = 100;
    expect(paths(p)).toContain('cabinet.columns[1].width');
  });
  it('rejects a column whose low side is below the minimum height', () => {
    const p = defaultProject();
    p.envelope.heightMin = 0; // last column x1 = 2500 -> ceilY = 84.6
    expect(paths(p)).toContain('cabinet.columns[3].width');
  });
  it('requires at least one drawer for drawer fronts', () => {
    const p = defaultProject();
    p.cabinet.columns[2].drawerCount = 0;
    expect(paths(p)).toContain('cabinet.columns[2].drawerCount');
  });
  it('does not produce NaN-driven errors when the envelope is invalid', () => {
    const p = defaultProject();
    p.envelope.length = 0;
    const errs = validate(p);
    expect(errs.map((e) => e.path)).toContain('envelope.length');
    expect(errs.every((e) => !e.message.includes('NaN'))).toBe(true);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `pnpm vitest run src/model/validate.test.ts`
Expected: FAIL, cannot resolve `./validate`.

- [ ] **Step 9: Write src/model/validate.ts**

```ts
import type { Project, ValidationError } from './types';
import { ceilY } from '../geometry/envelope';

export function validate(p: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });
  const { envelope: env, cabinet: cab } = p;

  if (!(env.length > 0)) err('envelope.length', 'Length must be > 0');
  if (!(env.heightMax > 0)) err('envelope.heightMax', 'Max height must be > 0');
  if (!(env.depth > 0)) err('envelope.depth', 'Depth must be > 0');
  if (!(env.heightMin >= 0 && env.heightMin < env.heightMax)) {
    err('envelope.heightMin', 'Min height must be >= 0 and < max height');
  }
  if (!(env.topClearance >= 0)) err('envelope.topClearance', 'Top clearance must be >= 0');

  if (!(cab.panelThickness > 0)) err('cabinet.panelThickness', 'Panel thickness must be > 0');
  if (!(cab.backThickness > 0)) err('cabinet.backThickness', 'Back thickness must be > 0');
  if (!(cab.plinthHeight >= 0)) err('cabinet.plinthHeight', 'Plinth height must be >= 0');
  if (!(cab.gapBack >= 0)) err('cabinet.gapBack', 'Back gap must be >= 0');
  if (!(cab.depth >= 200)) err('cabinet.depth', 'Cabinet depth must be >= 200');
  if (cab.depth + cab.gapBack > env.depth) {
    err('cabinet.depth', `Cabinet depth + back gap (${cab.depth + cab.gapBack}) exceeds envelope depth (${env.depth})`);
  }

  const total = cab.columns.reduce((s, c) => s + c.width, 0);
  if (total > env.length) err('cabinet.columns', `Columns total ${total} exceeds envelope length ${env.length}`);

  const envelopeOk = env.length > 0 && env.heightMin >= 0 && env.heightMax > env.heightMin;
  const t = cab.panelThickness;
  const minWidth = 2 * t + 100;
  const minHeight = cab.plinthHeight + 2 * t + 100;
  let x = 0;
  cab.columns.forEach((c, i) => {
    const path = `cabinet.columns[${i}]`;
    if (!(c.width >= minWidth)) err(`${path}.width`, `Column ${i + 1}: width must be >= ${minWidth}`);
    x += c.width;
    if (envelopeOk) {
      const hLow = ceilY(env, x) - env.topClearance;
      if (hLow < minHeight) {
        err(`${path}.width`, `Column ${i + 1}: low-side height ${Math.round(hLow)} is below minimum ${minHeight}`);
      }
    }
    if (c.front === 'drawers' && !(c.drawerCount >= 1)) err(`${path}.drawerCount`, `Column ${i + 1}: at least 1 drawer`);
    if (!(c.shelves >= 0)) err(`${path}.shelves`, `Column ${i + 1}: shelves must be >= 0`);
  });
  return errors;
}
```

- [ ] **Step 10: Run tests, typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (11 tests).

- [ ] **Step 11: Commit**

```bash
git add src/model src/geometry
git commit -m "feat: model types, defaults, validation, envelope math"
```

---

### Task 3: Vector math and transforms

**Files:**
- Create: `src/geometry/vec.ts`
- Test: `src/geometry/vec.test.ts`

**Interfaces:**
- Produces: `Vec2`, `Vec3`, `Box2`, `Box3`, `Transform`, `v2(x,y)`, `v3(x,y,z)`, `rotX/rotY/rotZ(p: Vec3, a: number): Vec3`, `toWorld(t: Transform, p: Vec3): Vec3`, `bounds2(pts: Vec2[]): Box2`, `bounds3(pts: Vec3[]): Box3`, `NO_ROT`, `FLAT_ROT`, `SIDE_ROT`, `ROD_ROT`.

- [ ] **Step 1: Write failing test src/geometry/vec.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { toWorld, bounds2, bounds3, v2, v3, FLAT_ROT, SIDE_ROT, ROD_ROT, NO_ROT } from './vec';

const near = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
  expect(a.z).toBeCloseTo(b.z, 6);
};

describe('toWorld', () => {
  it('FLAT_ROT lays a panel flat: local Y -> world Z, thickness goes down', () => {
    const t = { position: v3(10, 500, 0), rotation: FLAT_ROT };
    near(toWorld(t, v3(100, 50, 0)), v3(110, 500, 50));
    near(toWorld(t, v3(0, 0, 18)), v3(10, 482, 0));
  });
  it('SIDE_ROT stands a panel in YZ: local X -> world Z, thickness goes to -X', () => {
    const t = { position: v3(18, 100, 0), rotation: SIDE_ROT };
    near(toWorld(t, v3(600, 1000, 0)), v3(18, 1100, 600));
    near(toWorld(t, v3(0, 0, 18)), v3(0, 100, 0));
  });
  it('ROD_ROT extrudes along +X', () => {
    const t = { position: v3(18, 1630, 250), rotation: ROD_ROT };
    near(toWorld(t, v3(0, 0, 664)), v3(682, 1630, 250));
  });
  it('sloped top: X rotation then Z tilt', () => {
    const theta = Math.atan(0.5);
    const t = { position: v3(0, 2180, 0), rotation: v3(Math.PI / 2, 0, -theta) };
    const L = 700 / Math.cos(theta);
    near(toWorld(t, v3(L, 0, 0)), v3(700, 1830, 0));
    near(toWorld(t, v3(0, 600, 0)), v3(0, 2180, 600));
  });
  it('NO_ROT is identity plus translation', () => {
    near(toWorld({ position: v3(1, 2, 3), rotation: NO_ROT }, v3(1, 1, 1)), v3(2, 3, 4));
  });
});

describe('bounds', () => {
  it('bounds2/bounds3', () => {
    expect(bounds2([v2(1, 5), v2(-2, 3)])).toEqual({ min: { x: -2, y: 3 }, max: { x: 1, y: 5 } });
    expect(bounds3([v3(1, 5, 0), v3(-2, 3, 9)])).toEqual({ min: { x: -2, y: 3, z: 0 }, max: { x: 1, y: 5, z: 9 } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/geometry/vec.test.ts`
Expected: FAIL, cannot resolve `./vec`.

- [ ] **Step 3: Write src/geometry/vec.ts**

```ts
export interface Vec2 { x: number; y: number }
export interface Vec3 { x: number; y: number; z: number }
export interface Box2 { min: Vec2; max: Vec2 }
export interface Box3 { min: Vec3; max: Vec3 }
export interface Transform { position: Vec3; rotation: Vec3 } // radians, applied X then Y then Z

export const v2 = (x: number, y: number): Vec2 => ({ x, y });
export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const NO_ROT: Vec3 = v3(0, 0, 0);
/** Local XY plan outline lies flat; local Y -> world +Z; extrusion goes to world -Y. */
export const FLAT_ROT: Vec3 = v3(Math.PI / 2, 0, 0);
/** Local XY (depth, height) outline stands in the YZ plane; local X -> world +Z; extrusion -> world -X. */
export const SIDE_ROT: Vec3 = v3(0, -Math.PI / 2, 0);
/** Local XY circle; extrusion -> world +X. */
export const ROD_ROT: Vec3 = v3(0, Math.PI / 2, 0);

export function rotX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
export function rotY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
export function rotZ(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

export function toWorld(t: Transform, p: Vec3): Vec3 {
  const r = rotZ(rotY(rotX(p, t.rotation.x), t.rotation.y), t.rotation.z);
  return { x: r.x + t.position.x, y: r.y + t.position.y, z: r.z + t.position.z };
}

export function bounds2(pts: Vec2[]): Box2 {
  const b: Box2 = { min: v2(Infinity, Infinity), max: v2(-Infinity, -Infinity) };
  for (const p of pts) {
    b.min.x = Math.min(b.min.x, p.x); b.min.y = Math.min(b.min.y, p.y);
    b.max.x = Math.max(b.max.x, p.x); b.max.y = Math.max(b.max.y, p.y);
  }
  return b;
}

export function bounds3(pts: Vec3[]): Box3 {
  const b: Box3 = { min: v3(Infinity, Infinity, Infinity), max: v3(-Infinity, -Infinity, -Infinity) };
  for (const p of pts) {
    b.min.x = Math.min(b.min.x, p.x); b.min.y = Math.min(b.min.y, p.y); b.min.z = Math.min(b.min.z, p.z);
    b.max.x = Math.max(b.max.x, p.x); b.max.y = Math.max(b.max.y, p.y); b.max.z = Math.max(b.max.z, p.z);
  }
  return b;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/geometry/vec.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/geometry/vec.ts src/geometry/vec.test.ts
git commit -m "feat: vector math and part transforms"
```

---

### Task 4: Column layout (derived dimensions)

**Files:**
- Create: `src/geometry/column.ts`
- Test: `src/geometry/column.test.ts`

**Interfaces:**
- Consumes: `columnRanges`, `slopeAngle` (Task 2), `Vec2`, `v2` (Task 3).
- Produces: constants `REVEAL=2`, `DRAWER_GAP=3`, `SHELF_SETBACK=20`, `ROD_DROP=200`, `ROD_SETBACK=250`, `ROD_DIAMETER=25`, `PLINTH_SETBACK=40`; `ColumnLayout`; `layoutColumn(p, range): ColumnLayout`; `layoutColumns(p): ColumnLayout[]`.
- Column-local frame for `doorOutline`, `drawerFronts`, `fixedFront`: origin at `(x0, plinthHeight)` in the XY elevation. `shelfYs`, `rodY`, `floorY` are absolute Y.

- [ ] **Step 1: Write failing test src/geometry/column.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { layoutColumns } from './column';
import { defaultProject } from '../model/defaults';

const theta = Math.atan(0.5);
const topThick = 18 / Math.cos(theta); // 20.1246

describe('layoutColumns (default project, sloped)', () => {
  const L = layoutColumns(defaultProject());

  it('side heights differ: left at hTall, right at hLow, minus top thickness and plinth', () => {
    expect(L[0].topThick).toBeCloseTo(topThick, 4);
    expect(L[0].sideLeftH).toBeCloseTo(2180 - topThick - 100, 4);
    expect(L[0].sideRightH).toBeCloseTo(1830 - topThick - 100, 4);
  });
  it('interior dims', () => {
    expect(L[0].interiorWidth).toBe(664);
    expect(L[0].interiorDepth).toBe(596);
    expect(L[0].floorY).toBe(118);
    // interior height measured at the low side, inside the right side panel (x1 - t)
    expect(L[0].interiorHeight).toBeCloseTo(1830 - 9 - topThick - 118, 4);
    expect(L[0].backLeftH).toBeCloseTo(2180 - 9 - topThick - 118, 4);
    expect(L[0].backRightH).toBeCloseTo(L[0].interiorHeight, 8);
  });
  it('shelves at equal pitch', () => {
    const c = L[1];
    expect(c.shelfYs).toHaveLength(3);
    expect(c.shelfPitch).toBeCloseTo(c.interiorHeight / 4, 8);
    expect(c.shelfYs[0]).toBeCloseTo(118 + c.shelfPitch, 8);
    expect(c.shelfYs[2]).toBeCloseTo(118 + 3 * c.shelfPitch, 8);
  });
  it('drawer fronts fill plinth-top..hLow with reveals and gaps', () => {
    const c = L[2]; // hLow 1230, 4 drawers
    expect(c.drawerFronts).toHaveLength(4);
    const h = (1230 - 100 - 2 - 2 - 3 * 3) / 4; // 279.25
    expect(c.drawerFronts[0]).toEqual({ y0: 2, y1: 2 + h });
    expect(c.drawerFronts[3].y1).toBeCloseTo(1230 - 100 - 2, 8);
    expect(c.drawerFronts[1].y0 - c.drawerFronts[0].y1).toBeCloseTo(3, 8);
  });
  it('fixed front is the triangle above the drawers (right corner degenerates)', () => {
    const c = L[2];
    expect(c.fixedFront).not.toBeNull();
    const f = c.fixedFront!;
    expect(f[0]).toEqual({ x: 2, y: 1132 });
    expect(f[1]).toEqual({ x: 598, y: 1132 });
    expect(f[2].y).toBeCloseTo(1132, 8);           // max(1132, 1530-299-100-2 = 1129)
    expect(f[3].x).toBe(2);
    expect(f[3].y).toBeCloseTo(1530 - 1 - 100 - 2, 6);
  });
  it('door outline is the trapezoid inset by the reveal', () => {
    const d = L[0].doorOutline!;
    expect(d[0]).toEqual({ x: 2, y: 2 });
    expect(d[1]).toEqual({ x: 698, y: 2 });
    expect(d[2].x).toBe(698);
    expect(d[2].y).toBeCloseTo(2180 - 349 - 100 - 2, 6);
    expect(d[3].x).toBe(2);
    expect(d[3].y).toBeCloseTo(2180 - 1 - 100 - 2, 6);
    expect(L[2].doorOutline).toBeNull();
  });
  it('rod only for door/none fronts, at hLow - 200', () => {
    expect(L[0].rodY).toBe(1630);
    expect(L[1].rodY).toBeNull();
  });
});

describe('layoutColumns (stepped)', () => {
  const p = defaultProject();
  p.cabinet.topStyle = 'stepped';
  const L = layoutColumns(p);
  it('sides equal, top thickness is the panel thickness', () => {
    expect(L[0].topThick).toBe(18);
    expect(L[0].sideLeftH).toBe(1830 - 18 - 100);
    expect(L[0].sideRightH).toBe(1830 - 18 - 100);
    expect(L[0].backLeftH).toBe(L[0].backRightH);
  });
  it('no fixed front above drawers, door is a rectangle', () => {
    expect(L[2].fixedFront).toBeNull();
    const d = L[0].doorOutline!;
    expect(d[2].y).toBe(d[3].y);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/geometry/column.test.ts`
Expected: FAIL, cannot resolve `./column`.

- [ ] **Step 3: Write src/geometry/column.ts**

```ts
import type { Project } from '../model/types';
import { columnRanges, slopeAngle, type ColumnRange } from './envelope';
import { v2, type Vec2 } from './vec';

export const REVEAL = 2;
export const DRAWER_GAP = 3;
export const SHELF_SETBACK = 20;
export const ROD_DROP = 200;
export const ROD_SETBACK = 250;
export const ROD_DIAMETER = 25;
export const PLINTH_SETBACK = 40;

export interface DrawerFront { y0: number; y1: number } // column-local (origin at plinth top)

export interface ColumnLayout extends ColumnRange {
  topThick: number;       // vertical thickness of the top panel (t / cos theta when sloped)
  sideLeftH: number;      // side panel heights, from plinth top to underside of the top panel
  sideRightH: number;
  interiorWidth: number;
  interiorDepth: number;
  interiorHeight: number; // at the low side (inside the right side panel)
  floorY: number;         // absolute Y of the bottom panel top surface
  backLeftH: number;      // back panel heights at its left/right edges
  backRightH: number;
  shelfPitch: number;
  shelfYs: number[];      // absolute Y of each shelf top surface
  doorOutline: Vec2[] | null;      // column-local
  drawerFronts: DrawerFront[];     // column-local
  fixedFront: Vec2[] | null;       // column-local
  rodY: number | null;             // absolute Y of rod axis
}

export function layoutColumn(p: Project, r: ColumnRange): ColumnLayout {
  const cab = p.cabinet;
  const col = r.column;
  const t = cab.panelThickness;
  const plinth = cab.plinthHeight;
  const w = r.width;
  const theta = slopeAngle(p.envelope);
  const sloped = cab.topStyle === 'sloped';
  const tan = Math.tan(theta);
  const topThick = sloped ? t / Math.cos(theta) : t;

  /** outer top surface height at column-local x */
  const topY = (lx: number) => (sloped ? r.hTall - lx * tan : r.hLow);
  const topUnderY = (lx: number) => topY(lx) - topThick;

  const sideLeftH = topUnderY(0) - plinth;
  const sideRightH = topUnderY(w) - plinth;
  const interiorWidth = w - 2 * t;
  const interiorDepth = cab.depth - cab.backThickness;
  const floorY = plinth + t;
  const backLeftH = topUnderY(t) - floorY;
  const backRightH = topUnderY(w - t) - floorY;
  const interiorHeight = backRightH;

  const shelfPitch = interiorHeight / (col.shelves + 1);
  const shelfYs = Array.from({ length: col.shelves }, (_, k) => floorY + (k + 1) * shelfPitch);

  /** front outline height at column-local x, relative to plinth top */
  const frontTop = (lx: number) => topY(lx) - plinth;
  const R = REVEAL;

  let doorOutline: Vec2[] | null = null;
  let drawerFronts: DrawerFront[] = [];
  let fixedFront: Vec2[] | null = null;

  if (col.front === 'door') {
    doorOutline = [v2(R, R), v2(w - R, R), v2(w - R, frontTop(w - R) - R), v2(R, frontTop(R) - R)];
  } else if (col.front === 'drawers') {
    const n = col.drawerCount;
    const zoneBot = R;
    const zoneTop = r.hLow - plinth - R;
    const h = (zoneTop - zoneBot - (n - 1) * DRAWER_GAP) / n;
    drawerFronts = Array.from({ length: n }, (_, i) => {
      const y0 = zoneBot + i * (h + DRAWER_GAP);
      return { y0, y1: y0 + h };
    });
    if (sloped) {
      const y0 = r.hLow - plinth + R;
      const yR = Math.max(y0, frontTop(w - R) - R);
      const yL = frontTop(R) - R;
      fixedFront = [v2(R, y0), v2(w - R, y0), v2(w - R, yR), v2(R, yL)];
    }
  }

  const rodY = col.rod && col.front !== 'drawers' ? r.hLow - ROD_DROP : null;

  return {
    ...r,
    topThick, sideLeftH, sideRightH, interiorWidth, interiorDepth, interiorHeight, floorY,
    backLeftH, backRightH, shelfPitch, shelfYs, doorOutline, drawerFronts, fixedFront, rodY,
  };
}

export function layoutColumns(p: Project): ColumnLayout[] {
  return columnRanges(p).map((r) => layoutColumn(p, r));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/geometry/column.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/geometry/column.ts src/geometry/column.test.ts
git commit -m "feat: per-column derived layout"
```

---

### Task 5: Parts builder

**Files:**
- Create: `src/geometry/parts.ts`
- Test: `src/geometry/parts.test.ts`

**Interfaces:**
- Consumes: `layoutColumns`, constants (Task 4); `toWorld`, `bounds3`, rotation constants (Task 3); `slopeAngle` (Task 2).
- Produces: `PartKind`, `Part`, `rect(w, h): Vec2[]`, `circle(r, n): Vec2[]`, `buildParts(p: Project): Part[]`, `partBounds(part: Part): Box3`, `deg(rad): number` (1 decimal).
- Part ids: `col${index}-${key}` with keys `sideL, sideR, bottom, top, back, shelf1.., door, drawer1.., fixedFront, rod, plinth`.
- Deviation from spec §3.1: the plinth carries its column index (one board per column, attributed in the cut list); `columnIndex: null` stays reserved for future global parts.

- [ ] **Step 1: Write failing test src/geometry/parts.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { buildParts, partBounds, rect, circle } from './parts';
import { defaultProject } from '../model/defaults';

const theta = Math.atan(0.5);
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 4);

describe('buildParts (default project)', () => {
  const p = defaultProject();
  const parts = buildParts(p);
  const byId = (id: string) => parts.find((x) => x.id === id)!;

  it('creates the expected part count', () => {
    // col0: 6 carcass + door + rod = 8; col1: 6 + door + 3 shelves = 10;
    // col2: 6 + 4 drawers + fixed = 11; col3: 6 + 3 drawers + fixed = 10
    expect(parts).toHaveLength(39);
    // every column: sideL, sideR, bottom, top, back, plinth
    for (let i = 0; i < 4; i++) {
      for (const k of ['sideL', 'sideR', 'bottom', 'top', 'back', 'plinth']) expect(byId(`col${i}-${k}`)).toBeDefined();
    }
  });
  it('left side occupies [x0, x0+t] x [plinth, plinth+sideLeftH] x [0, depth]', () => {
    const b = partBounds(byId('col0-sideL'));
    near(b.min.x, 0); near(b.max.x, 18);
    near(b.min.y, 100); near(b.max.y, 100 + 2180 - 18 / Math.cos(theta) - 100);
    near(b.min.z, 0); near(b.max.z, 600);
    expect(byId('col0-sideL').notes?.[0]).toMatch(/bevel 26\.6/);
  });
  it('right side occupies [x1-t, x1]', () => {
    const b = partBounds(byId('col1-sideR'));
    near(b.min.x, 1282); near(b.max.x, 1300);
    near(b.max.y, 1530 - 18 / Math.cos(theta));
  });
  it('bottom sits on the plinth between the sides', () => {
    const b = partBounds(byId('col0-bottom'));
    near(b.min.x, 18); near(b.max.x, 682);
    near(b.min.y, 100); near(b.max.y, 118);
  });
  it('sloped top runs from (x0, hTall) to (x1, hLow)', () => {
    const top = byId('col0-top');
    const b = partBounds(top);
    near(b.max.y, 2180); near(b.max.x, 700);
    near(b.min.y, 1830 - 18 * Math.cos(theta));
    near(top.outline[1].x, 700 / Math.cos(theta));
    expect(top.notes?.[0]).toMatch(/end edges bevel 26\.6/);
  });
  it('back is a trapezoid at the rear, between the sides', () => {
    const back = byId('col0-back');
    const b = partBounds(back);
    near(b.min.z, 596); near(b.max.z, 600);
    near(b.min.x, 18); near(b.max.x, 682);
    near(b.min.y, 118);
    expect(back.material).toBe('back');
    expect(back.outline[3].y).toBeGreaterThan(back.outline[2].y);
  });
  it('shelves are set back 20 mm and sit at shelfYs', () => {
    const s = byId('col1-shelf1');
    const b = partBounds(s);
    near(b.min.z, 20); near(b.max.z, 596);
    near(b.min.x, 718); near(b.max.x, 1282);
    expect(byId('col1-shelf3')).toBeDefined();
    expect(parts.filter((x) => x.kind === 'shelf')).toHaveLength(3);
  });
  it('door sits in front of the carcass with a 2 mm reveal', () => {
    const b = partBounds(byId('col0-door'));
    near(b.min.z, -18); near(b.max.z, 0);
    near(b.min.x, 2); near(b.max.x, 698);
    near(b.min.y, 102);
  });
  it('drawer fronts and fixed front', () => {
    const d = parts.filter((x) => x.columnIndex === 2 && x.kind === 'drawerFront');
    expect(d).toHaveLength(4);
    const b = partBounds(d[0]);
    near(b.min.x, 1302); near(b.max.x, 1898); near(b.min.y, 102);
    const f = partBounds(byId('col2-fixedFront'));
    near(f.min.y, 1232);
  });
  it('rod runs across the interior at hLow-200, 250 mm back', () => {
    const rod = byId('col0-rod');
    const b = partBounds(rod);
    near(b.min.x, 18); near(b.max.x, 682);
    near((b.min.y + b.max.y) / 2, 1630);
    near((b.min.z + b.max.z) / 2, 250);
    near(b.max.y - b.min.y, 25);
    expect(rod.material).toBe('rod');
    expect(byId('col1-rod')).toBeUndefined();
  });
  it('plinth is set back 40 mm', () => {
    const b = partBounds(byId('col3-plinth'));
    near(b.min.z, 40); near(b.max.z, 58);
    near(b.min.x, 1900); near(b.max.x, 2500);
    near(b.max.y, 100);
  });
});

describe('stepped top', () => {
  it('top is flat at hLow, sides have no bevel note', () => {
    const p = defaultProject();
    p.cabinet.topStyle = 'stepped';
    const parts = buildParts(p);
    const top = parts.find((x) => x.id === 'col0-top')!;
    const b = partBounds(top);
    expect(b.max.y).toBeCloseTo(1830, 6);
    expect(b.min.y).toBeCloseTo(1812, 6);
    expect(top.notes).toBeUndefined();
    expect(parts.find((x) => x.id === 'col2-fixedFront')).toBeUndefined();
  });
});

describe('helpers', () => {
  it('rect and circle', () => {
    expect(rect(10, 5)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }]);
    const c = circle(12.5, 24);
    expect(c).toHaveLength(24);
    expect(Math.hypot(c[5].x, c[5].y)).toBeCloseTo(12.5, 8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/geometry/parts.test.ts`
Expected: FAIL, cannot resolve `./parts`.

- [ ] **Step 3: Write src/geometry/parts.ts**

```ts
import type { Project } from '../model/types';
import { slopeAngle } from './envelope';
import { layoutColumns, PLINTH_SETBACK, REVEAL, ROD_DIAMETER, ROD_SETBACK, SHELF_SETBACK } from './column';
import { bounds3, FLAT_ROT, NO_ROT, ROD_ROT, SIDE_ROT, toWorld, v2, v3, type Box3, type Transform, type Vec2, type Vec3 } from './vec';

export type PartKind =
  | 'side' | 'top' | 'bottom' | 'back' | 'shelf' | 'door' | 'drawerFront' | 'fixedFront' | 'plinth' | 'rod';
export type Material = 'panel' | 'back' | 'rod';

export interface Part {
  id: string;
  columnIndex: number | null;
  name: string;
  kind: PartKind;
  outline: Vec2[];      // local XY polygon, mm
  thickness: number;    // extrusion along local +Z
  transform: Transform;
  material: Material;
  notes?: string[];
}

export function rect(w: number, h: number): Vec2[] {
  return [v2(0, 0), v2(w, 0), v2(w, h), v2(0, h)];
}

export function circle(r: number, n: number): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return v2(r * Math.cos(a), r * Math.sin(a));
  });
}

export const deg = (rad: number) => Math.round((rad * 180) / Math.PI * 10) / 10;
const r1 = (x: number) => Math.round(x * 10) / 10;

export function partBounds(part: Part): Box3 {
  const pts: Vec3[] = [];
  for (const o of part.outline) {
    pts.push(toWorld(part.transform, v3(o.x, o.y, 0)));
    pts.push(toWorld(part.transform, v3(o.x, o.y, part.thickness)));
  }
  return bounds3(pts);
}

export function buildParts(p: Project): Part[] {
  const cab = p.cabinet;
  const t = cab.panelThickness;
  const plinth = cab.plinthHeight;
  const theta = slopeAngle(p.envelope);
  const sloped = cab.topStyle === 'sloped';
  const bevel = `bevel ${deg(theta)} deg`;
  const parts: Part[] = [];

  for (const L of layoutColumns(p)) {
    const i = L.index;
    const x0 = L.x0;
    const w = L.width;
    const add = (
      key: string, name: string, kind: PartKind, outline: Vec2[], thickness: number,
      position: Vec3, rotation: Vec3, material: Material = 'panel', notes?: string[],
    ) => parts.push({ id: `col${i}-${key}`, columnIndex: i, name, kind, outline, thickness, transform: { position, rotation }, material, notes });

    const trap = (hL: number, hR: number) => (sloped ? [`trapezoid L ${r1(hL)} / R ${r1(hR)}`] : undefined);

    add('sideL', 'Side L', 'side', rect(cab.depth, L.sideLeftH), t, v3(x0 + t, plinth, 0), SIDE_ROT, 'panel', sloped ? [`top edge ${bevel}`] : undefined);
    add('sideR', 'Side R', 'side', rect(cab.depth, L.sideRightH), t, v3(x0 + w, plinth, 0), SIDE_ROT, 'panel', sloped ? [`top edge ${bevel}`] : undefined);
    add('bottom', 'Bottom', 'bottom', rect(L.interiorWidth, cab.depth), t, v3(x0 + t, plinth + t, 0), FLAT_ROT);
    if (sloped) {
      add('top', 'Top', 'top', rect(w / Math.cos(theta), cab.depth), t, v3(x0, L.hTall, 0), v3(Math.PI / 2, 0, -theta), 'panel', [`end edges ${bevel}`]);
    } else {
      add('top', 'Top', 'top', rect(w, cab.depth), t, v3(x0, L.hLow, 0), FLAT_ROT);
    }
    add('back', 'Back', 'back',
      [v2(0, 0), v2(L.interiorWidth, 0), v2(L.interiorWidth, L.backRightH), v2(0, L.backLeftH)],
      cab.backThickness, v3(x0 + t, plinth + t, cab.depth - cab.backThickness), NO_ROT, 'back', trap(L.backLeftH, L.backRightH));
    L.shelfYs.forEach((y, k) => {
      add(`shelf${k + 1}`, `Shelf ${k + 1}`, 'shelf', rect(L.interiorWidth, L.interiorDepth - SHELF_SETBACK), t, v3(x0 + t, y, SHELF_SETBACK), FLAT_ROT);
    });
    if (L.doorOutline) {
      add('door', 'Door', 'door', L.doorOutline, t, v3(x0, plinth, -t), NO_ROT, 'panel', trap(L.doorOutline[3].y - L.doorOutline[0].y, L.doorOutline[2].y - L.doorOutline[1].y));
    }
    L.drawerFronts.forEach((d, k) => {
      add(`drawer${k + 1}`, `Drawer front ${k + 1}`, 'drawerFront', rect(w - 2 * REVEAL, d.y1 - d.y0), t, v3(x0 + REVEAL, plinth + d.y0, -t), NO_ROT);
    });
    if (L.fixedFront) {
      const f = L.fixedFront;
      add('fixedFront', 'Fixed front', 'fixedFront', f, t, v3(x0, plinth, -t), NO_ROT, 'panel', [`trapezoid L ${r1(f[3].y - f[0].y)} / R ${r1(f[2].y - f[1].y)}`]);
    }
    if (L.rodY !== null) {
      add('rod', 'Rod', 'rod', circle(ROD_DIAMETER / 2, 24), L.interiorWidth, v3(x0 + t, L.rodY, ROD_SETBACK), ROD_ROT, 'rod', [`dia ${ROD_DIAMETER} mm`]);
    }
    add('plinth', 'Plinth', 'plinth', rect(w, plinth), t, v3(x0, 0, PLINTH_SETBACK), NO_ROT);
  }
  return parts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/geometry/parts.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/geometry/parts.ts src/geometry/parts.test.ts
git commit -m "feat: build Part[] from the model"
```

---

### Task 6: Cut list

**Files:**
- Create: `src/cutlist/cutlist.ts`
- Test: `src/cutlist/cutlist.test.ts`

**Interfaces:**
- Consumes: `Part`, `buildParts` (Task 5), `bounds2` (Task 3), `ROD_DIAMETER` (Task 4).
- Produces: `CutRow { name, kind, columns: number[], qty, length, width, thickness, material, notes: string[] }`, `partDims(part): { length, width }`, `buildCutList(parts: Part[]): CutRow[]`. Columns are 1-based. Rows sorted by kind order `side, top, bottom, back, shelf, door, drawerFront, fixedFront, plinth, rod`, then name, then columns[0].

- [ ] **Step 1: Write failing test src/cutlist/cutlist.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { buildCutList, partDims } from './cutlist';
import { buildParts } from '../geometry/parts';
import { defaultProject } from '../model/defaults';

describe('cut list', () => {
  it('groups identical parts across columns', () => {
    const p = defaultProject();
    p.cabinet.topStyle = 'stepped';
    p.cabinet.columns = [{ ...p.cabinet.columns[1], width: 600 }, { ...p.cabinet.columns[1], id: 'x', width: 600 }];
    const rows = buildCutList(buildParts(p));
    const bottom = rows.find((r) => r.name === 'Bottom')!;
    expect(bottom.qty).toBe(2);
    expect(bottom.columns).toEqual([1, 2]);
    expect(bottom.length).toBe(600);
    expect(bottom.width).toBe(564);
    expect(bottom.thickness).toBe(18);
    // sides differ in height between the two columns -> separate rows
    expect(rows.filter((r) => r.name === 'Side L')).toHaveLength(2);
  });
  it('groups identical drawer fronts within a column', () => {
    const rows = buildCutList(buildParts(defaultProject()));
    const fronts = rows.filter((r) => r.kind === 'drawerFront' && r.columns.includes(3));
    expect(fronts).toHaveLength(1);
    expect(fronts[0].qty).toBe(4);
    expect(fronts[0].length).toBe(596);
    expect(fronts[0].width).toBe(279.3);
  });
  it('lists rod as length x diameter and keeps notes', () => {
    const rows = buildCutList(buildParts(defaultProject()));
    const rod = rows.find((r) => r.kind === 'rod')!;
    expect(rod.length).toBe(664);
    expect(rod.width).toBe(25);
    expect(rod.thickness).toBe(25);
    expect(rod.material).toBe('rod');
    expect(rod.notes).toEqual(['dia 25 mm']);
    const top = rows.find((r) => r.kind === 'top')!;
    expect(top.notes[0]).toMatch(/bevel/);
  });
  it('orders rows by kind then name', () => {
    const rows = buildCutList(buildParts(defaultProject()));
    expect(rows[0].kind).toBe('side');
    expect(rows[rows.length - 1].kind).toBe('rod');
  });
  it('partDims uses the outline bounding box, longer edge first', () => {
    const part = buildParts(defaultProject()).find((x) => x.id === 'col0-sideL')!;
    const d = partDims(part);
    expect(d.length).toBeCloseTo(2059.9, 1);
    expect(d.width).toBe(600);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/cutlist/cutlist.test.ts`
Expected: FAIL, cannot resolve `./cutlist`.

- [ ] **Step 3: Write src/cutlist/cutlist.ts**

```ts
import type { Part, PartKind } from '../geometry/parts';
import { bounds2 } from '../geometry/vec';
import { ROD_DIAMETER } from '../geometry/column';

export interface CutRow {
  name: string;
  kind: PartKind;
  columns: number[]; // 1-based
  qty: number;
  length: number;
  width: number;
  thickness: number;
  material: string;
  notes: string[];
}

const KIND_ORDER: PartKind[] = ['side', 'top', 'bottom', 'back', 'shelf', 'door', 'drawerFront', 'fixedFront', 'plinth', 'rod'];
const r1 = (x: number) => Math.round(x * 10) / 10;

export function partDims(part: Part): { length: number; width: number } {
  if (part.kind === 'rod') return { length: r1(part.thickness), width: ROD_DIAMETER };
  const b = bounds2(part.outline);
  const a = b.max.x - b.min.x;
  const c = b.max.y - b.min.y;
  return { length: r1(Math.max(a, c)), width: r1(Math.min(a, c)) };
}

export function buildCutList(parts: Part[]): CutRow[] {
  const groups = new Map<string, CutRow>();
  for (const part of parts) {
    const { length, width } = partDims(part);
    const thickness = part.kind === 'rod' ? ROD_DIAMETER : r1(part.thickness);
    const notes = part.notes ?? [];
    const key = [part.kind, part.name, length, width, thickness, part.material, notes.join(';')].join('|');
    const col = part.columnIndex === null ? [] : [part.columnIndex + 1];
    const row = groups.get(key);
    if (row) {
      row.qty += 1;
      for (const c of col) if (!row.columns.includes(c)) row.columns.push(c);
    } else {
      groups.set(key, { name: part.name, kind: part.kind, columns: col, qty: 1, length, width, thickness, material: part.material, notes });
    }
  }
  return [...groups.values()]
    .map((r) => ({ ...r, columns: [...r.columns].sort((a, b) => a - b) }))
    .sort((a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      a.name.localeCompare(b.name) ||
      (a.columns[0] ?? 0) - (b.columns[0] ?? 0));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/cutlist/cutlist.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cutlist
git commit -m "feat: cut list grouping"
```

---

### Task 7: Drawing IR, dimension expansion, mirroring

**Files:**
- Create: `src/drawing/ir.ts`, `src/drawing/dim.ts`
- Test: `src/drawing/ir.test.ts`

**Interfaces:**
- Consumes: `Vec2`, `Box2`, `bounds2`, `v2` (Task 3).
- Produces:
  - `Stroke = 'thin' | 'thick' | 'dashed'`, `Fill = 'panel' | 'none'`, `Anchor = 'start' | 'middle' | 'end'`
  - `Prim` union: `line`, `poly`, `text`, `dim`; `Drawing { title, prims, bounds, textSize }`
  - helpers `line(a, b, stroke?)`, `poly(pts, stroke?, fill?, closed?)`, `rectPrim(x, y, w, h, stroke?, fill?)`, `text(at, text, size?, anchor?, rotate?)`, `dim(a, b, offset, label?)`
  - `expandDim(d, textSize): Prim[]`, `fmtLen(n): string`, `expandPrims(prims, textSize): Prim[]` (no `dim` left), `makeDrawing(title, prims, textSize): Drawing`, `mirrorX(d: Drawing): Drawing`, `textSizeFor(w, h): number`.
- Dim convention: `offset` is measured along the left normal of `a -> b` (rotate direction +90 deg). Positive offset = left of the direction of travel. For a horizontal dim `a=(0,0), b=(L,0)`, negative offset places it below.

- [ ] **Step 1: Write failing test src/drawing/ir.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { dim, line, text, makeDrawing, expandPrims, mirrorX, textSizeFor, type Prim } from './ir';
import { expandDim, fmtLen } from './dim';
import { v2 } from '../geometry/vec';

describe('expandDim', () => {
  it('produces 5 lines and a centred label', () => {
    const prims = expandDim(dim(v2(0, 0), v2(2500, 0), -100), 40);
    const lines = prims.filter((p) => p.t === 'line');
    const texts = prims.filter((p) => p.t === 'text');
    expect(lines).toHaveLength(5);
    expect(texts).toHaveLength(1);
    const t = texts[0] as Extract<Prim, { t: 'text' }>;
    expect(t.text).toBe('2500');
    expect(t.at.x).toBeCloseTo(1250, 6);
    expect(t.at.y).toBeLessThan(-100); // below the dimension line (offset is negative -> below, label further out)
    expect(t.anchor).toBe('middle');
    expect(t.rotate ?? 0).toBe(0);
  });
  it('uses the label when provided and rotates vertical dims to 90', () => {
    const prims = expandDim(dim(v2(0, 0), v2(0, 1000), 50, 'H = 1000'), 40);
    const t = prims.find((p) => p.t === 'text') as Extract<Prim, { t: 'text' }>;
    expect(t.text).toBe('H = 1000');
    expect(t.rotate).toBe(90);
    expect(t.at.x).toBeLessThan(-50);
  });
  it('returns nothing for zero-length dims', () => {
    expect(expandDim(dim(v2(1, 1), v2(1, 1), 10), 40)).toEqual([]);
  });
  it('formats lengths', () => {
    expect(fmtLen(2500)).toBe('2500');
    expect(fmtLen(279.25)).toBe('279.3');
    expect(fmtLen(279.96)).toBe('280');
  });
});

describe('makeDrawing / expandPrims / mirrorX', () => {
  const prims: Prim[] = [line(v2(0, 0), v2(100, 0)), dim(v2(0, 0), v2(100, 0), -20), text(v2(10, 5), 'hi', 4, 'start')];
  const d = makeDrawing('T', prims, 4);
  it('bounds include expanded dims plus padding', () => {
    expect(d.bounds.min.y).toBeLessThan(-20);
    expect(d.bounds.max.x).toBeGreaterThanOrEqual(100 + 8);
    expect(d.bounds.min.x).toBeLessThanOrEqual(-8);
    expect(d.title).toBe('T');
    expect(d.textSize).toBe(4);
  });
  it('expandPrims removes dims', () => {
    expect(expandPrims(d.prims, d.textSize).some((p) => p.t === 'dim')).toBe(false);
  });
  it('mirrorX flips x, negates dim offsets, swaps text anchors', () => {
    const m = mirrorX(d);
    const l = m.prims[0] as Extract<Prim, { t: 'line' }>;
    expect(l.b.x).toBe(-100);
    const dm = m.prims[1] as Extract<Prim, { t: 'dim' }>;
    expect(dm.offset).toBe(20);
    expect(dm.b.x).toBe(-100);
    const tx = m.prims[2] as Extract<Prim, { t: 'text' }>;
    expect(tx.anchor).toBe('end');
    expect(tx.at.x).toBe(-10);
    expect(m.bounds.max.x).toBeCloseTo(-d.bounds.min.x, 6);
    // mirrored dim still reads as a dimension below the line
    const label = expandPrims(m.prims, m.textSize).find((p) => p.t === 'text' && p.text === '100') as Extract<Prim, { t: 'text' }>;
    expect(label.at.y).toBeLessThan(-20);
  });
  it('textSizeFor scales with drawing size with a floor', () => {
    expect(textSizeFor(2600, 2200)).toBeCloseTo(2600 / 60, 6);
    expect(textSizeFor(100, 100)).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/drawing/ir.test.ts`
Expected: FAIL, cannot resolve `./ir`.

- [ ] **Step 3: Write src/drawing/ir.ts**

```ts
import { bounds2, v2, type Box2, type Vec2 } from '../geometry/vec';
import { expandDim } from './dim';

export type Stroke = 'thin' | 'thick' | 'dashed';
export type Fill = 'panel' | 'none';
export type Anchor = 'start' | 'middle' | 'end';

export type Prim =
  | { t: 'line'; a: Vec2; b: Vec2; stroke?: Stroke }
  | { t: 'poly'; pts: Vec2[]; closed: boolean; stroke?: Stroke; fill?: Fill }
  | { t: 'text'; at: Vec2; text: string; size?: number; anchor?: Anchor; rotate?: number }
  | { t: 'dim'; a: Vec2; b: Vec2; offset: number; label?: string };

export interface Drawing {
  title: string;
  prims: Prim[];
  bounds: Box2;
  textSize: number;
}

export const line = (a: Vec2, b: Vec2, stroke: Stroke = 'thin'): Prim => ({ t: 'line', a, b, stroke });
export const poly = (pts: Vec2[], stroke: Stroke = 'thin', fill: Fill = 'none', closed = true): Prim => ({ t: 'poly', pts, closed, stroke, fill });
export const rectPrim = (x: number, y: number, w: number, h: number, stroke: Stroke = 'thin', fill: Fill = 'none'): Prim =>
  poly([v2(x, y), v2(x + w, y), v2(x + w, y + h), v2(x, y + h)], stroke, fill);
export const text = (at: Vec2, s: string, size?: number, anchor: Anchor = 'start', rotate?: number): Prim =>
  ({ t: 'text', at, text: s, size, anchor, rotate });
export const dim = (a: Vec2, b: Vec2, offset: number, label?: string): Prim => ({ t: 'dim', a, b, offset, label });

export function expandPrims(prims: Prim[], textSize: number): Prim[] {
  const out: Prim[] = [];
  for (const p of prims) {
    if (p.t === 'dim') out.push(...expandDim(p, textSize));
    else out.push(p);
  }
  return out;
}

function primPoints(p: Prim, textSize: number): Vec2[] {
  switch (p.t) {
    case 'line': return [p.a, p.b];
    case 'poly': return p.pts;
    case 'text': {
      const s = p.size ?? textSize;
      const w = p.text.length * s * 0.6;
      const x0 = p.anchor === 'end' ? p.at.x - w : p.anchor === 'middle' ? p.at.x - w / 2 : p.at.x;
      if (p.rotate) return [v2(p.at.x - s, p.at.y - s), v2(p.at.x + s, p.at.y + w)];
      return [v2(x0, p.at.y - s / 2), v2(x0 + w, p.at.y + s)];
    }
    case 'dim': return [];
  }
}

export function makeDrawing(title: string, prims: Prim[], textSize: number): Drawing {
  const pts = expandPrims(prims, textSize).flatMap((p) => primPoints(p, textSize));
  const b = pts.length ? bounds2(pts) : { min: v2(0, 0), max: v2(0, 0) };
  const pad = 2 * textSize;
  return {
    title,
    prims,
    textSize,
    bounds: { min: v2(b.min.x - pad, b.min.y - pad), max: v2(b.max.x + pad, b.max.y + pad) },
  };
}

export function mirrorX(d: Drawing): Drawing {
  const mx = (p: Vec2) => v2(-p.x, p.y);
  const prims: Prim[] = d.prims.map((p): Prim => {
    switch (p.t) {
      case 'line': return { ...p, a: mx(p.a), b: mx(p.b) };
      case 'poly': return { ...p, pts: p.pts.map(mx) };
      case 'text': return { ...p, at: mx(p.at), anchor: p.anchor === 'start' ? 'end' : p.anchor === 'end' ? 'start' : 'middle', rotate: p.rotate === undefined ? undefined : -p.rotate };
      case 'dim': return { ...p, a: mx(p.a), b: mx(p.b), offset: -p.offset };
    }
  });
  return makeDrawing(d.title, prims, d.textSize);
}

export function textSizeFor(w: number, h: number): number {
  return Math.max(20, Math.max(w, h) / 60);
}
```

- [ ] **Step 4: Write src/drawing/dim.ts**

```ts
import { v2, type Vec2 } from '../geometry/vec';
import type { Prim } from './ir';

export function fmtLen(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Expand a linear dimension into extension lines, dimension line, 45-degree ticks and a label. */
export function expandDim(d: Extract<Prim, { t: 'dim' }>, textSize: number): Prim[] {
  const dx = d.b.x - d.a.x, dy = d.b.y - d.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [];
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux; // left normal
  const o = d.offset;
  const sign = o >= 0 ? 1 : -1;
  const tick = textSize * 0.5;
  const P = (p: Vec2, s: number) => v2(p.x + nx * s, p.y + ny * s);
  const a2 = P(d.a, o), b2 = P(d.b, o);
  const out: Prim[] = [
    { t: 'line', a: d.a, b: P(d.a, o + sign * tick), stroke: 'thin' },
    { t: 'line', a: d.b, b: P(d.b, o + sign * tick), stroke: 'thin' },
    { t: 'line', a: a2, b: b2, stroke: 'thin' },
  ];
  for (const p of [a2, b2]) {
    const tx = (ux + nx) * tick * 0.5, ty = (uy + ny) * tick * 0.5;
    out.push({ t: 'line', a: v2(p.x - tx, p.y - ty), b: v2(p.x + tx, p.y + ty), stroke: 'thin' });
  }
  let rotate = Math.round((Math.atan2(uy, ux) * 180) / Math.PI);
  if (rotate > 90 || rotate <= -90) rotate += rotate > 0 ? -180 : 180;
  const mid = v2((a2.x + b2.x) / 2, (a2.y + b2.y) / 2);
  out.push({
    t: 'text',
    at: P(mid, sign * textSize * 0.6),
    text: d.label ?? fmtLen(len),
    size: textSize,
    anchor: 'middle',
    rotate: rotate === 0 ? undefined : rotate,
  });
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/drawing/ir.test.ts`
Expected: PASS (8 tests). If `t.rotate ?? 0` for the horizontal case fails, ensure `rotate` is `undefined` when 0 (it is, per the code above).

- [ ] **Step 6: Commit**

```bash
git add src/drawing/ir.ts src/drawing/dim.ts src/drawing/ir.test.ts
git commit -m "feat: drawing IR with dimensions and mirroring"
```

---

### Task 8: Views (front, plan, side, column detail)

**Files:**
- Create: `src/drawing/column.ts`, `src/drawing/views.ts`
- Test: `src/drawing/views.test.ts`

**Interfaces:**
- Consumes: `layoutColumns`, `ColumnLayout`, constants (Task 4); `circle`, `deg` (Task 5); `ceilY`, `slopeAngle` (Task 2); IR helpers, `makeDrawing`, `mirrorX`, `textSizeFor` (Task 7); `fmtLen` (Task 7).
- Produces: `columnFrontPrims(L, cab, dx = 0): Prim[]`, `columnSectionPrims(L, cab, dx = 0, side: 'left' | 'right' = 'right'): Prim[]`, `frontView(p): Drawing`, `planView(p): Drawing`, `sideView(p): Drawing`, `columnDetail(p, index): Drawing`.
- Plan view uses drawing-y = model Z (front of cabinet at the bottom of the page). Side/section views use drawing-x = model Z (front at left), drawing-y = model Y.
- Front and plan views are mirrored with `mirrorX` when `envelope.tallSide === 'right'`; side and column detail are not.

- [ ] **Step 1: Write failing test src/drawing/views.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { frontView, planView, sideView, columnDetail } from './views';
import { defaultProject } from '../model/defaults';
import { layoutColumns } from '../geometry/column';
import type { Drawing, Prim } from './ir';

const dimLens = (d: Drawing) =>
  d.prims.filter((p): p is Extract<Prim, { t: 'dim' }> => p.t === 'dim').map((p) => Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y));
const hasDim = (d: Drawing, v: number) => dimLens(d).some((l) => Math.abs(l - v) < 0.01);
const texts = (d: Drawing) => d.prims.filter((p): p is Extract<Prim, { t: 'text' }> => p.t === 'text').map((p) => p.text);

describe('frontView', () => {
  const p = defaultProject();
  const d = frontView(p);
  it('has title, envelope, column widths, heights, plinth and slope', () => {
    expect(d.title).toBe('Front elevation');
    for (const v of [2500, 2600, 700, 600, 2180, 1830, 930, 100]) expect(hasDim(d, v)).toBe(true);
    expect(texts(d)).toContain('slope 26.6 deg');
    expect(d.bounds.min.x).toBeLessThan(0);
    expect(d.bounds.max.y).toBeGreaterThan(2200);
  });
  it('draws filled fronts and dashed envelope', () => {
    const polys = d.prims.filter((q): q is Extract<Prim, { t: 'poly' }> => q.t === 'poly');
    expect(polys.some((q) => q.stroke === 'dashed')).toBe(true);
    expect(polys.filter((q) => q.fill === 'panel').length).toBeGreaterThanOrEqual(2 + 4 + 3); // 2 doors + 7 drawer fronts
  });
  it('mirrors when the tall side is on the right', () => {
    const q = defaultProject();
    q.envelope.tallSide = 'right';
    const m = frontView(q);
    expect(m.bounds.min.x).toBeLessThan(-2500);
    expect(m.bounds.max.x).toBeLessThan(500);
  });
});

describe('planView', () => {
  const d = planView(defaultProject());
  it('has depth, gap, column and envelope dims', () => {
    expect(d.title).toBe('Plan');
    for (const v of [600, 300, 900, 2600, 2500, 700]) expect(hasDim(d, v)).toBe(true);
    expect(texts(d)).not.toContain('NaN');
  });
});

describe('sideView', () => {
  const d = sideView(defaultProject());
  it('shows envelope rectangle and first column section with dims', () => {
    expect(d.title).toMatch(/Side section/);
    for (const v of [2200, 2180, 900, 600, 300, 100]) expect(hasDim(d, v)).toBe(true);
  });
  it('works with no columns', () => {
    const p = defaultProject();
    p.cabinet.columns = [];
    expect(hasDim(sideView(p), 2200)).toBe(true);
    expect(hasDim(frontView(p), 2600)).toBe(true);
    expect(hasDim(planView(p), 900)).toBe(true);
  });
});

describe('columnDetail', () => {
  const p = defaultProject();
  const L = layoutColumns(p);
  it('shelf column: width, heights, interior dims, pitch', () => {
    const d = columnDetail(p, 1);
    expect(d.title).toBe('Column 2 detail');
    for (const v of [600, 1830, 1530, 564, L[1].interiorHeight, L[1].shelfPitch]) expect(hasDim(d, v)).toBe(true);
    expect(texts(d)).toContain('Front');
  });
  it('drawer column: one dim per drawer front', () => {
    const d = columnDetail(p, 2);
    expect(dimLens(d).filter((l) => Math.abs(l - 279.25) < 0.01)).toHaveLength(4);
  });
  it('rod column: rod height dim', () => {
    const d = columnDetail(p, 0);
    expect(hasDim(d, 1630)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/drawing/views.test.ts`
Expected: FAIL, cannot resolve `./views`.

- [ ] **Step 3: Write src/drawing/column.ts**

```ts
import type { Cabinet } from '../model/types';
import { PLINTH_SETBACK, REVEAL, ROD_DIAMETER, ROD_SETBACK, SHELF_SETBACK, type ColumnLayout } from '../geometry/column';
import { circle } from '../geometry/parts';
import { v2, type Vec2 } from '../geometry/vec';
import { line, poly, rectPrim, type Prim } from './ir';

/** Front elevation of one column in absolute XY, shifted by dx. */
export function columnFrontPrims(L: ColumnLayout, cab: Cabinet, dx = 0): Prim[] {
  const x0 = L.x0 + dx, x1 = L.x1 + dx;
  const t = cab.panelThickness, pl = cab.plinthHeight;
  const sh = (q: Vec2) => v2(q.x + x0, q.y + pl);
  const out: Prim[] = [];
  out.push(poly([v2(x0, pl), v2(x1, pl), v2(x1, L.hLow), v2(x0, L.hTall)], 'thick'));
  out.push(rectPrim(x0, pl, t, L.sideLeftH));
  out.push(rectPrim(x1 - t, pl, t, L.sideRightH));
  out.push(rectPrim(x0, 0, L.width, pl));
  if (L.doorOutline) out.push(poly(L.doorOutline.map(sh), 'thin', 'panel'));
  for (const d of L.drawerFronts) out.push(rectPrim(x0 + REVEAL, pl + d.y0, L.width - 2 * REVEAL, d.y1 - d.y0, 'thin', 'panel'));
  if (L.fixedFront) out.push(poly(L.fixedFront.map(sh), 'thin', 'panel'));
  if (L.column.front === 'none') {
    for (const y of L.shelfYs) out.push(rectPrim(x0 + t, y - t, L.interiorWidth, t));
    if (L.rodY !== null) out.push(line(v2(x0 + t, L.rodY), v2(x1 - t, L.rodY), 'dashed'));
  }
  return out;
}

/** Section through one column: drawing-x = model Z (front at dx), drawing-y = model Y. */
export function columnSectionPrims(L: ColumnLayout, cab: Cabinet, dx = 0, side: 'left' | 'right' = 'right'): Prim[] {
  const t = cab.panelThickness, pl = cab.plinthHeight, D = cab.depth, bt = cab.backThickness;
  const h = side === 'right' ? L.hLow : L.hTall;
  const sideH = side === 'right' ? L.sideRightH : L.sideLeftH;
  const topUnder = h - L.topThick;
  const rodY = L.rodY;
  const out: Prim[] = [];
  out.push(rectPrim(dx, pl, D, sideH, 'thick'));
  out.push(rectPrim(dx, pl, D, t));
  out.push(rectPrim(dx, topUnder, D, L.topThick));
  out.push(rectPrim(dx + D - bt, pl + t, bt, topUnder - pl - t));
  for (const y of L.shelfYs) out.push(rectPrim(dx + SHELF_SETBACK, y - t, L.interiorDepth - SHELF_SETBACK, t));
  if (rodY !== null) out.push(poly(circle(ROD_DIAMETER / 2, 24).map((q) => v2(q.x + dx + ROD_SETBACK, q.y + rodY))));
  out.push(rectPrim(dx + PLINTH_SETBACK, 0, t, pl));
  if (L.doorOutline) out.push(rectPrim(dx - t, pl + REVEAL, t, h - pl - 2 * REVEAL, 'thin', 'panel'));
  for (const d of L.drawerFronts) out.push(rectPrim(dx - t, pl + d.y0, t, d.y1 - d.y0, 'thin', 'panel'));
  return out;
}
```

- [ ] **Step 4: Write src/drawing/views.ts**

```ts
import type { Project } from '../model/types';
import { slopeAngle } from '../geometry/envelope';
import { layoutColumns, PLINTH_SETBACK, REVEAL } from '../geometry/column';
import { deg } from '../geometry/parts';
import { v2 } from '../geometry/vec';
import { dim, line, makeDrawing, mirrorX, poly, rectPrim, text, textSizeFor, type Drawing, type Prim } from './ir';
import { fmtLen } from './dim';
import { columnFrontPrims, columnSectionPrims } from './column';

function finish(p: Project, title: string, prims: Prim[], s: number, mirror: boolean): Drawing {
  const d = makeDrawing(title, prims, s);
  return mirror && p.envelope.tallSide === 'right' ? mirrorX(d) : d;
}

export function frontView(p: Project): Drawing {
  const env = p.envelope, cab = p.cabinet;
  const s = textSizeFor(env.length, env.heightMax);
  const cols = layoutColumns(p);
  const total = cols.length ? cols[cols.length - 1].x1 : 0;
  const prims: Prim[] = [];
  prims.push(poly([v2(0, 0), v2(env.length, 0), v2(env.length, env.heightMin), v2(0, env.heightMax)], 'dashed'));
  for (const L of cols) prims.push(...columnFrontPrims(L, cab));
  if (cols.length) {
    prims.push(dim(v2(0, 0), v2(total, 0), -3 * s));
    for (const L of cols) prims.push(dim(v2(L.x0, 0), v2(L.x1, 0), -1.5 * s));
    prims.push(dim(v2(0, 0), v2(0, cols[0].hTall), 2 * s));
    cols.forEach((L, i) => prims.push(dim(v2(L.x1, 0), v2(L.x1, L.hLow), i === cols.length - 1 ? -2 * s : -0.8 * s)));
    prims.push(dim(v2(0, 0), v2(0, cab.plinthHeight), 5 * s, `plinth ${fmtLen(cab.plinthHeight)}`));
  }
  prims.push(dim(v2(0, 0), v2(env.length, 0), -5.5 * s));
  prims.push(text(v2(env.length / 2, env.heightMax + 1.5 * s), `slope ${deg(slopeAngle(env))} deg`, s, 'middle'));
  return finish(p, 'Front elevation', prims, s, true);
}

export function planView(p: Project): Drawing {
  const env = p.envelope, cab = p.cabinet;
  const t = cab.panelThickness, bt = cab.backThickness;
  const s = textSizeFor(env.length, env.depth);
  const cols = layoutColumns(p);
  const total = cols.length ? cols[cols.length - 1].x1 : 0;
  const prims: Prim[] = [rectPrim(0, 0, env.length, env.depth, 'dashed')];
  for (const L of cols) {
    prims.push(rectPrim(L.x0, 0, L.width, cab.depth, 'thick'));
    prims.push(rectPrim(L.x0, 0, t, cab.depth));
    prims.push(rectPrim(L.x1 - t, 0, t, cab.depth));
    prims.push(rectPrim(L.x0 + t, cab.depth - bt, L.interiorWidth, bt));
    prims.push(line(v2(L.x0, PLINTH_SETBACK), v2(L.x1, PLINTH_SETBACK), 'dashed'));
    if (L.doorOutline || L.drawerFronts.length) prims.push(rectPrim(L.x0 + REVEAL, -t, L.width - 2 * REVEAL, t, 'thin', 'panel'));
  }
  if (cols.length) {
    prims.push(dim(v2(0, 0), v2(total, 0), -3 * s));
    for (const L of cols) prims.push(dim(v2(L.x0, 0), v2(L.x1, 0), -1.5 * s));
    prims.push(dim(v2(total, 0), v2(total, cab.depth), -2 * s));
    prims.push(dim(v2(total, cab.depth), v2(total, env.depth), -2 * s, `gap ${fmtLen(env.depth - cab.depth)}`));
  }
  prims.push(dim(v2(env.length, 0), v2(env.length, env.depth), -5 * s));
  prims.push(dim(v2(0, env.depth), v2(env.length, env.depth), 2 * s));
  return finish(p, 'Plan', prims, s, true);
}

export function sideView(p: Project): Drawing {
  const env = p.envelope, cab = p.cabinet;
  const s = textSizeFor(env.depth, env.heightMax);
  const cols = layoutColumns(p);
  const prims: Prim[] = [rectPrim(0, 0, env.depth, env.heightMax, 'dashed')];
  if (cols.length) {
    const L = cols[0];
    prims.push(...columnSectionPrims(L, cab, 0, 'left'));
    prims.push(dim(v2(0, 0), v2(0, L.hTall), 3 * s));
    prims.push(dim(v2(0, 0), v2(cab.depth, 0), -1.5 * s));
    prims.push(dim(v2(cab.depth, 0), v2(env.depth, 0), -1.5 * s, `gap ${fmtLen(env.depth - cab.depth)}`));
  }
  prims.push(dim(v2(0, 0), v2(0, env.heightMax), 6 * s));
  prims.push(dim(v2(0, 0), v2(env.depth, 0), -3.5 * s));
  prims.push(dim(v2(env.depth, 0), v2(env.depth, cab.plinthHeight), -2 * s, `plinth ${fmtLen(cab.plinthHeight)}`));
  return finish(p, 'Side section (tall end)', prims, s, false);
}

export function columnDetail(p: Project, index: number): Drawing {
  const cab = p.cabinet, t = cab.panelThickness, pl = cab.plinthHeight;
  const L = layoutColumns(p)[index];
  const s = textSizeFor(L.width + cab.depth, L.hTall);
  const dx = -L.x0;               // front drawn with the column at x = 0
  const sx = L.width + 6 * s;     // section origin
  const prims: Prim[] = [...columnFrontPrims(L, cab, dx), ...columnSectionPrims(L, cab, sx, 'right')];
  const topUnder = L.hLow - L.topThick;
  const zr = sx + cab.depth;      // section right edge
  // front dims
  prims.push(dim(v2(0, 0), v2(L.width, 0), -1.5 * s));
  prims.push(dim(v2(0, 0), v2(0, L.hTall), 2 * s));
  prims.push(dim(v2(t, L.floorY), v2(L.width - t, L.floorY), 1.5 * s, `inner ${fmtLen(L.interiorWidth)}`));
  for (const d of L.drawerFronts) prims.push(dim(v2(L.width, pl + d.y0), v2(L.width, pl + d.y1), -1.5 * s));
  // section dims
  prims.push(dim(v2(sx, 0), v2(sx, L.hLow), 2 * s));
  prims.push(dim(v2(zr, L.floorY), v2(zr, topUnder), -1.5 * s, `inner ${fmtLen(L.interiorHeight)}`));
  if (L.shelfYs.length) prims.push(dim(v2(zr, L.floorY), v2(zr, L.shelfYs[0]), -3.5 * s, `pitch ${fmtLen(L.shelfPitch)}`));
  if (L.rodY !== null) prims.push(dim(v2(zr, 0), v2(zr, L.rodY), -3.5 * s, `rod ${fmtLen(L.rodY)}`));
  prims.push(dim(v2(sx, 0), v2(zr, 0), -1.5 * s));
  prims.push(text(v2(0, L.hTall + 1.5 * s), 'Front', s, 'start'));
  prims.push(text(v2(sx, L.hTall + 1.5 * s), 'Section (low side)', s, 'start'));
  return makeDrawing(`Column ${index + 1} detail`, prims, s);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/drawing/views.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add src/drawing
git commit -m "feat: front, plan, side and column detail views"
```

---

### Task 9: SVG renderer

**Files:**
- Create: `src/render/svg.ts`
- Test: `src/render/svg.test.ts`

**Interfaces:**
- Consumes: `Drawing`, `Prim`, `Stroke`, `expandPrims` (Task 7); `frontView` (Task 8).
- Produces: `drawingToSvg(d: Drawing): string` — a complete `<svg>` element with a viewBox from `d.bounds`, Y flipped, stroke widths in px via `vector-effect="non-scaling-stroke"`.

- [ ] **Step 1: Write failing test src/render/svg.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { drawingToSvg } from './svg';
import { frontView } from '../drawing/views';
import { makeDrawing, text, line, poly } from '../drawing/ir';
import { defaultProject } from '../model/defaults';
import { v2 } from '../geometry/vec';

describe('drawingToSvg', () => {
  it('renders the front view with a viewBox and dimension labels', () => {
    const svg = drawingToSvg(frontView(defaultProject()));
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="')).toBe(true);
    expect(svg).toContain('<title>Front elevation</title>');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<line');
    expect(svg).toContain('>2500<');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).not.toContain('NaN');
    expect(svg.endsWith('</svg>')).toBe(true);
  });
  it('flips Y, rotates text the other way, escapes text', () => {
    const d = makeDrawing('t', [
      line(v2(0, 0), v2(10, 20)),
      text(v2(5, 5), 'a<b', 4, 'middle', 90),
      poly([v2(0, 0), v2(1, 0), v2(1, 1)], 'thick', 'panel'),
    ], 4);
    const svg = drawingToSvg(d);
    expect(svg).toContain('y2="-20"');
    expect(svg).toContain('rotate(-90)');
    expect(svg).toContain('a&lt;b');
    expect(svg).toContain('fill="#e8e2d5"');
    expect(svg).toContain('stroke-width="2"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/render/svg.test.ts`
Expected: FAIL, cannot resolve `./svg`.

- [ ] **Step 3: Write src/render/svg.ts**

```ts
import { expandPrims, type Drawing, type Prim, type Stroke } from '../drawing/ir';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f = (n: number) => String(Math.round(n * 100) / 100);

function strokeAttrs(stroke: Stroke | undefined): string {
  const w = stroke === 'thick' ? 2 : 1;
  const dash = stroke === 'dashed' ? ' stroke-dasharray="6 4"' : '';
  return `stroke="#111" stroke-width="${w}" vector-effect="non-scaling-stroke"${dash}`;
}

function primToSvg(p: Prim, textSize: number): string {
  switch (p.t) {
    case 'line':
      return `<line x1="${f(p.a.x)}" y1="${f(-p.a.y)}" x2="${f(p.b.x)}" y2="${f(-p.b.y)}" ${strokeAttrs(p.stroke)}/>`;
    case 'poly': {
      const pts = p.pts.map((q) => `${f(q.x)},${f(-q.y)}`).join(' ');
      const fill = p.fill === 'panel' ? '#e8e2d5' : 'none';
      return p.closed
        ? `<polygon points="${pts}" fill="${fill}" ${strokeAttrs(p.stroke)}/>`
        : `<polyline points="${pts}" fill="none" ${strokeAttrs(p.stroke)}/>`;
    }
    case 'text': {
      const size = p.size ?? textSize;
      const rot = p.rotate ? ` rotate(${f(-p.rotate)})` : '';
      return `<text transform="translate(${f(p.at.x)} ${f(-p.at.y)})${rot}" font-size="${f(size)}" text-anchor="${p.anchor ?? 'start'}" dominant-baseline="middle" fill="#111">${esc(p.text)}</text>`;
    }
    case 'dim':
      return '';
  }
}

export function drawingToSvg(d: Drawing): string {
  const b = d.bounds;
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(b.min.x)} ${f(-b.max.y)} ${f(w)} ${f(h)}" font-family="Helvetica, Arial, sans-serif">`,
    `<title>${esc(d.title)}</title>`,
  ];
  for (const p of expandPrims(d.prims, d.textSize)) {
    const s = primToSvg(p, d.textSize);
    if (s) out.push(s);
  }
  out.push('</svg>');
  return out.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/render/svg.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/svg.ts src/render/svg.test.ts
git commit -m "feat: SVG renderer"
```

---

### Task 10: PDF renderer and document

**Files:**
- Create: `src/render/pdf.ts`, `src/pdf/exportPdf.ts`
- Test: `src/render/pdf.test.ts`, `src/pdf/exportPdf.test.ts`

**Interfaces:**
- Consumes: `Drawing`, `expandPrims` (Task 7); views (Task 8); `buildParts`, `deg` (Task 5); `buildCutList`, `CutRow` (Task 6); `layoutColumns` (Task 4); `slopeAngle` (Task 2).
- Produces: `STANDARD_SCALES`, `PdfBox { x, y, w, h }` (mm on page), `pickScale(drawW, drawH, box): number`, `drawingToPdf(doc: jsPDF, d: Drawing, box: PdfBox): number` (returns N), `PdfOptions { snapshotPng?: string | null; date?: Date }`, `buildPdf(p, opts?): jsPDF`, `exportPdfBlob(p, opts?): Blob`.
- Page order: summary, front, plan, side, one per column, cut list pages (27 rows per page).

- [ ] **Step 1: Write failing test src/render/pdf.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { pickScale, drawingToPdf } from './pdf';
import { frontView } from '../drawing/views';
import { defaultProject } from '../model/defaults';

describe('pickScale', () => {
  it('rounds up to a standard scale', () => {
    const box = { x: 0, y: 0, w: 273, h: 170 };
    expect(pickScale(2600, 2200, box)).toBe(20);   // raw 12.94
    expect(pickScale(2600, 800, box)).toBe(10);    // raw 9.52
    expect(pickScale(100, 100, box)).toBe(1);
    expect(pickScale(100000, 100, box)).toBe(367); // beyond the table -> ceil(366.3)
  });
});

describe('drawingToPdf', () => {
  it('draws the front view onto a page and returns the scale', () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const N = drawingToPdf(doc, frontView(defaultProject()), { x: 12, y: 22, w: 273, h: 170 });
    expect(N).toBe(20);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(2000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/render/pdf.test.ts`
Expected: FAIL, cannot resolve `./pdf`. (If instead jsPDF fails to import under the node environment, add `// @vitest-environment jsdom` at the top of both PDF test files and `pnpm add -D jsdom`.)

- [ ] **Step 3: Write src/render/pdf.ts**

```ts
import type { jsPDF } from 'jspdf';
import { expandPrims, type Drawing, type Stroke } from '../drawing/ir';
import type { Vec2 } from '../geometry/vec';

export const STANDARD_SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200];
export interface PdfBox { x: number; y: number; w: number; h: number }

export function pickScale(drawW: number, drawH: number, box: PdfBox): number {
  const raw = Math.max(drawW / box.w, drawH / box.h);
  return STANDARD_SCALES.find((n) => n >= raw) ?? Math.ceil(raw);
}

const PT_PER_MM = 72 / 25.4;

function applyStroke(doc: jsPDF, s: Stroke | undefined): void {
  doc.setLineWidth(s === 'thick' ? 0.5 : 0.2);
  doc.setLineDashPattern(s === 'dashed' ? [2, 1] : [], 0);
}

function polygon(doc: jsPDF, pts: Vec2[], style: string, closed: boolean): void {
  if (pts.length < 2) return;
  const segs = pts.slice(1).map((q, i) => [q.x - pts[i].x, q.y - pts[i].y]);
  doc.lines(segs, pts[0].x, pts[0].y, [1, 1], style, closed);
}

/** Draws `d` centred in `box` at the chosen standard scale. Returns N of 1:N. */
export function drawingToPdf(doc: jsPDF, d: Drawing, box: PdfBox): number {
  const b = d.bounds;
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  const N = pickScale(w, h, box);
  const ox = box.x + (box.w - w / N) / 2 - b.min.x / N;
  const oy = box.y + (box.h - h / N) / 2 + b.max.y / N;
  const X = (x: number) => ox + x / N;
  const Y = (y: number) => oy - y / N;
  doc.setDrawColor(20, 20, 20);
  doc.setTextColor(20, 20, 20);
  doc.setFillColor(232, 226, 213);
  for (const p of expandPrims(d.prims, d.textSize)) {
    if (p.t === 'line') {
      applyStroke(doc, p.stroke);
      doc.line(X(p.a.x), Y(p.a.y), X(p.b.x), Y(p.b.y));
    } else if (p.t === 'poly') {
      applyStroke(doc, p.stroke);
      polygon(doc, p.pts.map((q) => ({ x: X(q.x), y: Y(q.y) })), p.fill === 'panel' ? 'FD' : 'S', p.closed);
    } else if (p.t === 'text') {
      doc.setFontSize(((p.size ?? d.textSize) / N) * PT_PER_MM);
      doc.text(p.text, X(p.at.x), Y(p.at.y), {
        angle: p.rotate ?? 0,
        align: p.anchor === 'end' ? 'right' : p.anchor === 'middle' ? 'center' : 'left',
        baseline: 'middle',
      });
    }
  }
  doc.setLineDashPattern([], 0);
  return N;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/render/pdf.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write failing test src/pdf/exportPdf.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { buildPdf } from './exportPdf';
import { defaultProject } from '../model/defaults';
import { buildCutList } from '../cutlist/cutlist';
import { buildParts } from '../geometry/parts';

describe('buildPdf', () => {
  it('produces summary + 3 views + one page per column + cut list pages', () => {
    const p = defaultProject();
    const doc = buildPdf(p, { date: new Date('2026-09-07T00:00:00Z') });
    const rows = buildCutList(buildParts(p)).length;
    const cutPages = Math.max(1, Math.ceil(rows / 27));
    expect(doc.getNumberOfPages()).toBe(4 + 4 + cutPages);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(5000);
  });
  it('handles zero columns', () => {
    const p = defaultProject();
    p.cabinet.columns = [];
    expect(buildPdf(p).getNumberOfPages()).toBe(5);
  });
  it('does not throw on a bad snapshot', () => {
    expect(() => buildPdf(defaultProject(), { snapshotPng: 'data:image/png;base64,not-a-png' })).not.toThrow();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm vitest run src/pdf/exportPdf.test.ts`
Expected: FAIL, cannot resolve `./exportPdf`.

- [ ] **Step 7: Write src/pdf/exportPdf.ts**

```ts
import { jsPDF } from 'jspdf';
import type { Project } from '../model/types';
import { buildParts, deg } from '../geometry/parts';
import { slopeAngle } from '../geometry/envelope';
import { layoutColumns } from '../geometry/column';
import { buildCutList, type CutRow } from '../cutlist/cutlist';
import { columnDetail, frontView, planView, sideView } from '../drawing/views';
import type { Drawing } from '../drawing/ir';
import { drawingToPdf, type PdfBox } from '../render/pdf';

export interface PdfOptions { snapshotPng?: string | null; date?: Date }

const W = 297, H = 210, M = 12;
const BOX: PdfBox = { x: M, y: M + 10, w: W - 2 * M, h: H - 2 * M - 16 };
const ROW_H = 6;
export const ROWS_PER_PAGE = 27;

export function buildPdf(p: Project, opts: PdfOptions = {}): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  summaryPage(doc, p, opts);
  for (const d of [frontView(p), planView(p), sideView(p)]) {
    doc.addPage();
    drawingPage(doc, d);
  }
  layoutColumns(p).forEach((_, i) => {
    doc.addPage();
    drawingPage(doc, columnDetail(p, i));
  });
  cutListPages(doc, buildCutList(buildParts(p)));
  return doc;
}

export function exportPdfBlob(p: Project, opts: PdfOptions = {}): Blob {
  return buildPdf(p, opts).output('blob');
}

function header(doc: jsPDF, title: string): void {
  doc.setFontSize(14);
  doc.text(title, M, M + 4);
  doc.setLineWidth(0.3);
  doc.line(M, M + 7, W - M, M + 7);
}

function drawingPage(doc: jsPDF, d: Drawing): void {
  header(doc, d.title);
  const N = drawingToPdf(doc, d, BOX);
  doc.setFontSize(9);
  doc.text(`Scale 1:${N} (mm)`, W - M, H - M / 2, { align: 'right' });
}

function summaryPage(doc: jsPDF, p: Project, opts: PdfOptions): void {
  header(doc, p.name || 'Under-stairs cabinet');
  const date = (opts.date ?? new Date()).toISOString().slice(0, 10);
  const env = p.envelope, cab = p.cabinet;
  const columns = cab.columns
    .map((c, i) => `${i + 1}: ${c.width} ${c.front}${c.front === 'drawers' ? ` x${c.drawerCount}` : ''}${c.shelves ? ` +${c.shelves} shelves` : ''}${c.rod && c.front !== 'drawers' ? ' rod' : ''}`)
    .join('; ');
  const rows: [string, string][] = [
    ['Date', date],
    ['Envelope length', `${env.length}`],
    ['Height max / min', `${env.heightMax} / ${env.heightMin}`],
    ['Envelope depth', `${env.depth}`],
    ['Slope', `${deg(slopeAngle(env))} deg`],
    ['Tall side', env.tallSide],
    ['Top clearance', `${env.topClearance}`],
    ['Cabinet depth / gap', `${cab.depth} / ${cab.gapBack}`],
    ['Panel / back thickness', `${cab.panelThickness} / ${cab.backThickness}`],
    ['Plinth height', `${cab.plinthHeight}`],
    ['Top style', cab.topStyle],
    ['Columns', columns || 'none'],
  ];
  doc.setFontSize(10);
  let y = M + 16;
  for (const [k, v] of rows) {
    doc.text(k, M, y);
    const lines = doc.splitTextToSize(v, 100) as string[];
    doc.text(lines, M + 50, y);
    y += ROW_H * Math.max(1, lines.length);
  }
  const imgX = W - M - 120, imgY = M + 14;
  if (opts.snapshotPng) {
    try {
      doc.addImage(opts.snapshotPng, 'PNG', imgX, imgY, 120, 80);
    } catch {
      doc.text('(3D snapshot unavailable)', imgX, imgY + 6);
    }
  } else {
    doc.text('(open the 3D tab before exporting to include a snapshot)', imgX, imgY + 6);
  }
}

function cutListPages(doc: jsPDF, rows: CutRow[]): void {
  const cols: [string, number][] = [
    ['#', M], ['Part', M + 10], ['Col', M + 58], ['Qty', M + 74], ['Length', M + 88],
    ['Width', M + 108], ['Thk', M + 128], ['Material', M + 142], ['Notes', M + 166],
  ];
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  for (let page = 0; page < pages; page++) {
    doc.addPage();
    header(doc, page === 0 ? 'Cut list' : `Cut list (cont. ${page + 1})`);
    doc.setFontSize(9);
    let y = M + 14;
    for (const [name, x] of cols) doc.text(name, x, y);
    y += ROW_H;
    const start = page * ROWS_PER_PAGE;
    rows.slice(start, start + ROWS_PER_PAGE).forEach((r, j) => {
      const vals = [
        String(start + j + 1), r.name, r.columns.join(','), String(r.qty), String(r.length),
        String(r.width), String(r.thickness), r.material, r.notes.join('; ').slice(0, 55),
      ];
      vals.forEach((v, k) => doc.text(v, cols[k][1], y));
      y += ROW_H;
    });
  }
  const total = rows.reduce((s, r) => s + r.qty, 0);
  doc.setFontSize(9);
  doc.text(`Total parts: ${total}`, W - M, H - M / 2, { align: 'right' });
}
```

- [ ] **Step 8: Run tests, typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. If `addImage` with the bogus data URL throws outside the try (it should not), wrap the whole snapshot branch.

- [ ] **Step 9: Commit**

```bash
git add src/render/pdf.ts src/render/pdf.test.ts src/pdf
git commit -m "feat: PDF renderer and multi-page export"
```

---

### Task 11: Store and persistence

**Files:**
- Create: `src/store/persist.ts`, `src/store/store.ts`
- Test: `src/store/store.test.ts`

**Interfaces:**
- Consumes: model types, `defaultProject`, `defaultColumn`, `validate` (Task 2).
- Produces:
  - persist: `STORAGE_KEY`, `FILE_VERSION = 1`, `serializeProject(p): string`, `parseProjectJson(text): { ok: true; project } | { ok: false; error }`, `StorageLike`, `loadFromStorage(storage): Project | null`, `saveToStorage(storage, p): void`
  - store: `Tab`, `UiState`, `PlannerState`, `createPlannerStore(initial?)`, `PlannerStore`, `startAutosave(store, storage, delay?): () => void`, `useStore` (singleton bound to `localStorage` when available)
- `lastValid` is the most recent project that passed validation; `loadProject` is only called with validated projects.

- [ ] **Step 1: Write failing test src/store/store.test.ts**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createPlannerStore, startAutosave } from './store';
import { serializeProject, parseProjectJson, loadFromStorage } from './persist';
import { defaultProject } from '../model/defaults';

const memStorage = () => {
  const mem = new Map<string, string>();
  return { mem, getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
};

describe('store', () => {
  it('keeps lastValid when an edit makes the project invalid', () => {
    const s = createPlannerStore();
    const before = s.getState().project;
    s.getState().setEnvelope({ heightMin: 5000 });
    expect(s.getState().errors.length).toBeGreaterThan(0);
    expect(s.getState().lastValid).toBe(before);
    s.getState().setEnvelope({ heightMin: 900 });
    expect(s.getState().errors).toEqual([]);
    expect(s.getState().lastValid).toBe(s.getState().project);
  });
  it('addColumn appends 500 when it fits, else the remainder, else toasts', () => {
    const s = createPlannerStore();
    s.getState().addColumn(); // 2500 of 2600 used: remainder 100 < min 136
    expect(s.getState().project.cabinet.columns).toHaveLength(4);
    expect(s.getState().ui.toast).toMatch(/No room/);
    s.getState().setEnvelope({ length: 3000 });
    s.getState().addColumn();
    expect(s.getState().project.cabinet.columns[4].width).toBe(500);
    s.getState().setEnvelope({ length: 3200 });
    s.getState().addColumn();
    expect(s.getState().project.cabinet.columns[5].width).toBe(200);
  });
  it('updateColumn, moveColumn, removeColumn', () => {
    const s = createPlannerStore();
    const [a, b] = s.getState().project.cabinet.columns;
    s.getState().updateColumn(b.id, { shelves: 5 });
    expect(s.getState().project.cabinet.columns[1].shelves).toBe(5);
    s.getState().moveColumn(b.id, -1);
    expect(s.getState().project.cabinet.columns[0].id).toBe(b.id);
    s.getState().moveColumn(b.id, -1); // no-op at the start
    expect(s.getState().project.cabinet.columns[0].id).toBe(b.id);
    s.getState().removeColumn(a.id);
    expect(s.getState().project.cabinet.columns.find((c) => c.id === a.id)).toBeUndefined();
  });
  it('newProject and loadProject replace the project', () => {
    const s = createPlannerStore();
    s.getState().setName('X');
    s.getState().newProject();
    expect(s.getState().project.name).toBe(defaultProject().name);
    const p = defaultProject();
    p.name = 'Loaded';
    s.getState().loadProject(p);
    expect(s.getState().lastValid.name).toBe('Loaded');
  });
  it('autosaves debounced', () => {
    vi.useFakeTimers();
    const storage = memStorage();
    const s = createPlannerStore();
    const stop = startAutosave(s, storage, 100);
    s.getState().setName('A');
    s.getState().setName('B');
    expect(storage.mem.size).toBe(0);
    vi.advanceTimersByTime(150);
    expect(loadFromStorage(storage)?.name).toBe('B');
    stop();
    vi.useRealTimers();
  });
});

describe('persist', () => {
  it('round-trips JSON', () => {
    const p = defaultProject();
    const r = parseProjectJson(serializeProject(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });
  it('rejects garbage, wrong version, bad shape, invalid project', () => {
    expect(parseProjectJson('nope').ok).toBe(false);
    expect(parseProjectJson('{"version":2,"project":{}}').ok).toBe(false);
    expect(parseProjectJson('{"version":1,"project":{"name":"x"}}').ok).toBe(false);
    const p = defaultProject();
    p.cabinet.depth = 5000;
    const r = parseProjectJson(serializeProject(p));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/validation/);
  });
  it('loadFromStorage returns null for empty or corrupt storage', () => {
    const storage = memStorage();
    expect(loadFromStorage(storage)).toBeNull();
    storage.setItem('understairs-planner:project', '{broken');
    expect(loadFromStorage(storage)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/store.test.ts`
Expected: FAIL, cannot resolve `./store`.

- [ ] **Step 3: Write src/store/persist.ts**

```ts
import type { Project } from '../model/types';
import { validate } from '../model/validate';

export const STORAGE_KEY = 'understairs-planner:project';
export const FILE_VERSION = 1;

export function serializeProject(p: Project): string {
  return JSON.stringify({ version: FILE_VERSION, project: p }, null, 2);
}

export type ParseResult = { ok: true; project: Project } | { ok: false; error: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isProjectShape(v: unknown): v is Project {
  if (!isObj(v) || typeof v.name !== 'string' || !isObj(v.envelope) || !isObj(v.cabinet)) return false;
  const e = v.envelope, c = v.cabinet;
  if (!['length', 'heightMax', 'heightMin', 'depth', 'topClearance'].every((k) => isNum(e[k]))) return false;
  if (e.tallSide !== 'left' && e.tallSide !== 'right') return false;
  if (!['panelThickness', 'backThickness', 'plinthHeight', 'depth', 'gapBack'].every((k) => isNum(c[k]))) return false;
  if (c.topStyle !== 'sloped' && c.topStyle !== 'stepped') return false;
  if (!Array.isArray(c.columns)) return false;
  return c.columns.every(
    (col: unknown) =>
      isObj(col) && typeof col.id === 'string' && isNum(col.width) &&
      (col.front === 'none' || col.front === 'door' || col.front === 'drawers') &&
      isNum(col.shelves) && isNum(col.drawerCount) && typeof col.rod === 'boolean',
  );
}

export function parseProjectJson(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON' };
  }
  if (!isObj(data) || data.version !== FILE_VERSION) return { ok: false, error: `Expected a planner file with version ${FILE_VERSION}` };
  if (!isProjectShape(data.project)) return { ok: false, error: 'File does not contain a valid project' };
  const errors = validate(data.project);
  if (errors.length) return { ok: false, error: `Project fails validation: ${errors[0].message}` };
  return { ok: true, project: data.project };
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function loadFromStorage(storage: StorageLike): Project | null {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return null;
    const r = parseProjectJson(text);
    return r.ok ? r.project : null;
  } catch {
    return null;
  }
}

export function saveToStorage(storage: StorageLike, p: Project): void {
  try {
    storage.setItem(STORAGE_KEY, serializeProject(p));
  } catch {
    // quota exceeded or storage disabled: autosave is best-effort
  }
}
```

- [ ] **Step 4: Write src/store/store.ts**

```ts
import { create } from 'zustand';
import type { Cabinet, Column, Envelope, Project, ValidationError } from '../model/types';
import { defaultColumn, defaultProject } from '../model/defaults';
import { validate } from '../model/validate';
import { loadFromStorage, saveToStorage, type StorageLike } from './persist';

export type Tab = '3d' | 'front' | 'plan' | 'side' | 'cutlist';

export interface UiState {
  tab: Tab;
  showDims: boolean;
  explode: number; // 0..1
  showEnvelope: boolean;
  toast: string | null;
}

export interface PlannerState {
  project: Project;
  errors: ValidationError[];
  lastValid: Project;
  ui: UiState;
  setProject: (updater: (p: Project) => Project) => void;
  setName: (name: string) => void;
  setEnvelope: (patch: Partial<Envelope>) => void;
  setCabinet: (patch: Partial<Omit<Cabinet, 'columns'>>) => void;
  updateColumn: (id: string, patch: Partial<Omit<Column, 'id'>>) => void;
  addColumn: () => void;
  removeColumn: (id: string) => void;
  moveColumn: (id: string, dir: -1 | 1) => void;
  newProject: () => void;
  loadProject: (p: Project) => void;
  setUi: (patch: Partial<UiState>) => void;
  toast: (msg: string | null) => void;
}

export function createPlannerStore(initial: Project = defaultProject()) {
  const initialErrors = validate(initial);
  return create<PlannerState>()((set, get) => ({
    project: initial,
    errors: initialErrors,
    lastValid: initialErrors.length ? defaultProject() : initial,
    ui: { tab: '3d', showDims: true, explode: 0, showEnvelope: true, toast: null },

    setProject: (updater) =>
      set((s) => {
        const project = updater(s.project);
        const errors = validate(project);
        return { project, errors, lastValid: errors.length ? s.lastValid : project };
      }),
    setName: (name) => get().setProject((p) => ({ ...p, name })),
    setEnvelope: (patch) => get().setProject((p) => ({ ...p, envelope: { ...p.envelope, ...patch } })),
    setCabinet: (patch) => get().setProject((p) => ({ ...p, cabinet: { ...p.cabinet, ...patch } })),
    updateColumn: (id, patch) =>
      get().setProject((p) => ({
        ...p,
        cabinet: { ...p.cabinet, columns: p.cabinet.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
      })),
    addColumn: () => {
      const p = get().project;
      const used = p.cabinet.columns.reduce((s, c) => s + c.width, 0);
      const remaining = p.envelope.length - used;
      const minWidth = 2 * p.cabinet.panelThickness + 100;
      const width = remaining >= 500 ? 500 : remaining >= minWidth ? remaining : 0;
      if (width === 0) {
        get().toast('No room for another column');
        return;
      }
      get().setProject((q) => ({ ...q, cabinet: { ...q.cabinet, columns: [...q.cabinet.columns, defaultColumn(width)] } }));
    },
    removeColumn: (id) =>
      get().setProject((p) => ({ ...p, cabinet: { ...p.cabinet, columns: p.cabinet.columns.filter((c) => c.id !== id) } })),
    moveColumn: (id, dir) =>
      get().setProject((p) => {
        const cols = [...p.cabinet.columns];
        const i = cols.findIndex((c) => c.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= cols.length) return p;
        [cols[i], cols[j]] = [cols[j], cols[i]];
        return { ...p, cabinet: { ...p.cabinet, columns: cols } };
      }),
    newProject: () => get().loadProject(defaultProject()),
    loadProject: (project) => set({ project, errors: validate(project), lastValid: project }),
    setUi: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
    toast: (msg) => set((s) => ({ ui: { ...s.ui, toast: msg } })),
  }));
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;

export function startAutosave(store: PlannerStore, storage: StorageLike, delay = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsub = store.subscribe((s, prev) => {
    if (s.project === prev.project) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveToStorage(storage, s.project), delay);
  });
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}

const browserStorage: StorageLike | null = typeof localStorage !== 'undefined' ? localStorage : null;
export const useStore = createPlannerStore((browserStorage && loadFromStorage(browserStorage)) ?? defaultProject());
if (browserStorage) startAutosave(useStore, browserStorage);
```

- [ ] **Step 5: Run tests, typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (8 new tests).

- [ ] **Step 6: Commit**

```bash
git add src/store
git commit -m "feat: zustand store, autosave and JSON import/export"
```

---

### Task 12: UI shell — top bar, sidebar, forms, toast

**Files:**
- Create: `src/ui/fields.tsx`, `src/ui/Sidebar.tsx`, `src/ui/ColumnCard.tsx`, `src/ui/TopBar.tsx`, `src/ui/Toast.tsx`, `src/ui/download.ts`, `src/ui/snapshot.ts`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `useStore`, `Tab` (Task 11); `serializeProject`, `parseProjectJson` (Task 11); `exportPdfBlob` (Task 10); `columnRanges` (Task 2).
- Produces: `NumberField`, `SelectField`, `CheckField`, `Section`; `Sidebar`; `ColumnCard`; `TopBar`; `Toast`; `downloadBlob(blob, filename)`; `setSnapshotter(fn | null)`, `takeSnapshot(): string | null` (wired to the canvas in Task 14).
- No unit tests (React UI is verified manually per spec §6). Typecheck and build must pass.

- [ ] **Step 1: Write src/ui/fields.tsx**

```tsx
import type { ReactNode } from 'react';

export function NumberField({ label, value, onChange, min, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        step={step}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </label>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function CheckField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Write src/ui/ColumnCard.tsx**

```tsx
import type { Column } from '../model/types';
import { useStore } from '../store/store';
import { columnRanges } from '../geometry/envelope';
import { CheckField, NumberField, SelectField } from './fields';

export function ColumnCard({ column, index, count }: { column: Column; index: number; count: number }) {
  const project = useStore((s) => s.project);
  const updateColumn = useStore((s) => s.updateColumn);
  const removeColumn = useStore((s) => s.removeColumn);
  const moveColumn = useStore((s) => s.moveColumn);
  const range = columnRanges(project)[index];
  const fmt = (n: number) => (Number.isFinite(n) ? String(Math.round(n)) : '-');
  const set = (patch: Partial<Omit<Column, 'id'>>) => updateColumn(column.id, patch);
  return (
    <div className="card">
      <strong>Column {index + 1}</strong>
      <NumberField label="Width" value={column.width} min={1} onChange={(v) => set({ width: v })} />
      <SelectField
        label="Front"
        value={column.front}
        options={[{ value: 'none', label: 'Open' }, { value: 'door', label: 'Door' }, { value: 'drawers', label: 'Drawers' }]}
        onChange={(v) => set({ front: v })}
      />
      {column.front === 'drawers' ? (
        <NumberField label="Drawers" value={column.drawerCount} min={1} onChange={(v) => set({ drawerCount: Math.round(v) })} />
      ) : (
        <CheckField label="Hanging rod" value={column.rod} onChange={(v) => set({ rod: v })} />
      )}
      <NumberField label="Shelves" value={column.shelves} min={0} onChange={(v) => set({ shelves: Math.round(v) })} />
      <div className="derived">top: tall {fmt(range.hTall)} / low {fmt(range.hLow)} mm</div>
      <div className="row">
        <button disabled={index === 0} onClick={() => moveColumn(column.id, -1)}>Left</button>
        <button disabled={index === count - 1} onClick={() => moveColumn(column.id, 1)}>Right</button>
        <button onClick={() => removeColumn(column.id)}>Remove</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write src/ui/Sidebar.tsx**

```tsx
import { useStore } from '../store/store';
import { NumberField, Section, SelectField } from './fields';
import { ColumnCard } from './ColumnCard';

export function Sidebar() {
  const project = useStore((s) => s.project);
  const errors = useStore((s) => s.errors);
  const setEnvelope = useStore((s) => s.setEnvelope);
  const setCabinet = useStore((s) => s.setCabinet);
  const addColumn = useStore((s) => s.addColumn);
  const { envelope: env, cabinet: cab } = project;
  return (
    <aside className="sidebar">
      {errors.length > 0 && (
        <div className="errors">
          {errors.map((e, i) => <div key={i}>{e.message}</div>)}
        </div>
      )}
      <Section title="Envelope">
        <NumberField label="Length" value={env.length} min={1} onChange={(v) => setEnvelope({ length: v })} />
        <NumberField label="Height max" value={env.heightMax} min={1} onChange={(v) => setEnvelope({ heightMax: v })} />
        <NumberField label="Height min" value={env.heightMin} min={0} onChange={(v) => setEnvelope({ heightMin: v })} />
        <NumberField label="Depth" value={env.depth} min={1} onChange={(v) => setEnvelope({ depth: v })} />
        <NumberField label="Top clearance" value={env.topClearance} min={0} onChange={(v) => setEnvelope({ topClearance: v })} />
        <SelectField
          label="Tall side"
          value={env.tallSide}
          options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
          onChange={(v) => setEnvelope({ tallSide: v })}
        />
      </Section>
      <Section title="Cabinet">
        <NumberField label="Depth" value={cab.depth} min={200} onChange={(v) => setCabinet({ depth: v })} />
        <NumberField label="Gap to back wall" value={cab.gapBack} min={0} onChange={(v) => setCabinet({ gapBack: v })} />
        <NumberField label="Panel thickness" value={cab.panelThickness} min={1} onChange={(v) => setCabinet({ panelThickness: v })} />
        <NumberField label="Back thickness" value={cab.backThickness} min={1} onChange={(v) => setCabinet({ backThickness: v })} />
        <NumberField label="Plinth height" value={cab.plinthHeight} min={0} onChange={(v) => setCabinet({ plinthHeight: v })} />
        <SelectField
          label="Top style"
          value={cab.topStyle}
          options={[{ value: 'sloped', label: 'Sloped' }, { value: 'stepped', label: 'Stepped' }]}
          onChange={(v) => setCabinet({ topStyle: v })}
        />
      </Section>
      <Section title="Columns">
        {cab.columns.map((c, i) => <ColumnCard key={c.id} column={c} index={i} count={cab.columns.length} />)}
        <button onClick={addColumn}>Add column</button>
      </Section>
    </aside>
  );
}
```

- [ ] **Step 4: Write src/ui/download.ts and src/ui/snapshot.ts**

`src/ui/download.ts`:
```ts
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

`src/ui/snapshot.ts`:
```ts
let snapshotter: (() => string) | null = null;

/** Registered by the 3D viewport while mounted. */
export function setSnapshotter(fn: (() => string) | null): void {
  snapshotter = fn;
}

/** PNG data URL of the 3D canvas, or null when the viewport is not mounted or capture fails. */
export function takeSnapshot(): string | null {
  if (!snapshotter) return null;
  try {
    return snapshotter();
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Write src/ui/Toast.tsx**

```tsx
import { useEffect } from 'react';
import { useStore } from '../store/store';

export function Toast() {
  const msg = useStore((s) => s.ui.toast);
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => toast(null), 4000);
    return () => clearTimeout(id);
  }, [msg, toast]);
  return msg ? <div className="toast">{msg}</div> : null;
}
```

- [ ] **Step 6: Write src/ui/TopBar.tsx**

```tsx
import { useRef, useState } from 'react';
import { useStore, type Tab } from '../store/store';
import { parseProjectJson, serializeProject } from '../store/persist';
import { exportPdfBlob } from '../pdf/exportPdf';
import { downloadBlob } from './download';
import { takeSnapshot } from './snapshot';

const TABS: { key: Tab; label: string }[] = [
  { key: '3d', label: '3D' },
  { key: 'front', label: 'Front' },
  { key: 'plan', label: 'Plan' },
  { key: 'side', label: 'Side' },
  { key: 'cutlist', label: 'Cut list' },
];

export function TopBar() {
  const project = useStore((s) => s.project);
  const lastValid = useStore((s) => s.lastValid);
  const tab = useStore((s) => s.ui.tab);
  const { setName, setUi, newProject, loadProject, toast } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const safeName = (project.name || 'cabinet').replace(/[^\w.-]+/g, '_');

  const onNew = () => {
    if (window.confirm('Replace the current project with the defaults?')) newProject();
  };
  const onExportJson = () => {
    downloadBlob(new Blob([serializeProject(project)], { type: 'application/json' }), `${safeName}.json`);
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const r = parseProjectJson(await file.text());
    if (r.ok) {
      loadProject(r.project);
      toast('Project imported');
    } else {
      toast(`Import failed: ${r.error}`);
    }
  };
  const onExportPdf = async () => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 0)); // let the button repaint
      const blob = exportPdfBlob(lastValid, { snapshotPng: takeSnapshot() });
      downloadBlob(blob, `${safeName}.pdf`);
    } catch (e) {
      toast(`PDF export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <input className="name" value={project.name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === tab ? 'active' : ''} onClick={() => setUi({ tab: t.key })}>
            {t.label}
          </button>
        ))}
      </nav>
      <span className="spacer" />
      <button onClick={onNew}>New</button>
      <button onClick={() => fileRef.current?.click()}>Import JSON</button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void onImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button onClick={onExportJson}>Export JSON</button>
      <button onClick={onExportPdf} disabled={busy}>{busy ? 'Exporting...' : 'Export PDF'}</button>
    </header>
  );
}
```

- [ ] **Step 7: Replace src/App.tsx (placeholders for tabs built in Tasks 13-14)**

```tsx
import { useStore } from './store/store';
import { TopBar } from './ui/TopBar';
import { Sidebar } from './ui/Sidebar';
import { Toast } from './ui/Toast';

export function App() {
  const tab = useStore((s) => s.ui.tab);
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <Sidebar />
        <main className="content">
          <div className="placeholder">{tab} view</div>
        </main>
      </div>
      <Toast />
    </div>
  );
}
```

- [ ] **Step 8: Replace src/styles.css**

```css
:root { font-family: system-ui, sans-serif; font-size: 14px; color: #222; }
body { margin: 0; }
button { font: inherit; padding: 4px 10px; border: 1px solid #bbb; background: #fff; border-radius: 3px; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: default; }
.app { display: grid; grid-template-rows: 48px 1fr; height: 100vh; }
.topbar { display: flex; align-items: center; gap: 8px; padding: 0 12px; border-bottom: 1px solid #ddd; background: #fafafa; }
.topbar input.name { font-size: 15px; padding: 4px 8px; width: 220px; }
.tabs { display: flex; gap: 2px; margin-left: 12px; }
.tabs button.active { background: #2b6cb0; color: #fff; border-color: #2b6cb0; }
.spacer { flex: 1; }
.main { display: grid; grid-template-columns: 320px 1fr; min-height: 0; }
.sidebar { overflow-y: auto; padding: 12px; border-right: 1px solid #ddd; background: #f6f6f6; }
.sidebar h3 { margin: 12px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
.field { display: grid; grid-template-columns: 1fr 110px; align-items: center; gap: 6px; margin: 4px 0; }
.field input, .field select { width: 100%; box-sizing: border-box; padding: 3px 6px; font: inherit; }
.field input[type="checkbox"] { width: auto; justify-self: start; }
.errors { background: #fde8e8; color: #9b1c1c; padding: 8px; border-radius: 4px; margin-bottom: 8px; }
.errors div { margin: 2px 0; }
.card { background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 8px; margin: 6px 0; }
.card .row { display: flex; gap: 4px; justify-content: flex-end; margin-top: 6px; }
.card .derived { font-size: 12px; color: #666; margin-top: 4px; }
.content { position: relative; min-width: 0; min-height: 0; overflow: auto; background: #fff; }
.placeholder { padding: 24px; color: #888; }
.view2d { width: 100%; height: 100%; padding: 12px; box-sizing: border-box; }
.view2d svg { width: 100%; height: 100%; }
.viewport { width: 100%; height: 100%; position: relative; }
.viewport .controls { position: absolute; top: 8px; left: 8px; background: rgba(255,255,255,0.9); padding: 6px 10px; border-radius: 4px; display: flex; gap: 12px; align-items: center; }
.dim3d { background: rgba(255,255,255,0.85); padding: 1px 4px; border-radius: 3px; font-size: 12px; white-space: nowrap; }
table.cutlist { border-collapse: collapse; margin: 12px; }
table.cutlist th, table.cutlist td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
table.cutlist tfoot td { font-weight: 600; }
.toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: 8px 14px; border-radius: 4px; z-index: 10; }
```

- [ ] **Step 9: Verify manually**

Run: `pnpm typecheck && pnpm build`, then `pnpm dev` and open the URL. Check:
- Sidebar shows the default project; editing "Height min" to 2200 shows a red error and the app keeps working.
- "Add column" toasts "No room for another column" on the default project; after setting Length to 3000 it appends a column.
- Left/Right/Remove buttons reorder and remove cards.
- New (confirm), Export JSON (downloads `Under-stairs_cabinet.json`), Import JSON of that file (toast "Project imported"), Import of a text file (toast "Import failed: ...").
- Export PDF downloads a PDF with 9 or 10 pages (no snapshot yet).
- Reload the page: edits persist (localStorage).

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: app shell with sidebar forms, top bar, JSON/PDF actions"
```

---

### Task 13: 2D view tabs and cut list table

**Files:**
- Create: `src/ui/View2D.tsx`, `src/ui/CutListTable.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useStore` (Task 11); `frontView/planView/sideView` (Task 8); `drawingToSvg` (Task 9); `buildParts` (Task 5); `buildCutList` (Task 6).
- Produces: `View2D({ tab: 'front' | 'plan' | 'side' })`, `CutListTable()`.
- Both render from `lastValid`, so an invalid edit never breaks the view.

- [ ] **Step 1: Write src/ui/View2D.tsx**

```tsx
import { useMemo } from 'react';
import { useStore } from '../store/store';
import { frontView, planView, sideView } from '../drawing/views';
import { drawingToSvg } from '../render/svg';

export function View2D({ tab }: { tab: 'front' | 'plan' | 'side' }) {
  const project = useStore((s) => s.lastValid);
  const svg = useMemo(() => {
    const d = tab === 'front' ? frontView(project) : tab === 'plan' ? planView(project) : sideView(project);
    return drawingToSvg(d);
  }, [project, tab]);
  return <div className="view2d" dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

- [ ] **Step 2: Write src/ui/CutListTable.tsx**

```tsx
import { useMemo } from 'react';
import { useStore } from '../store/store';
import { buildParts } from '../geometry/parts';
import { buildCutList } from '../cutlist/cutlist';

export function CutListTable() {
  const project = useStore((s) => s.lastValid);
  const rows = useMemo(() => buildCutList(buildParts(project)), [project]);
  const total = rows.reduce((s, r) => s + r.qty, 0);
  return (
    <table className="cutlist">
      <thead>
        <tr>
          <th>#</th><th>Part</th><th>Col</th><th>Qty</th><th>Length</th><th>Width</th><th>Thk</th><th>Material</th><th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{i + 1}</td><td>{r.name}</td><td>{r.columns.join(', ')}</td><td>{r.qty}</td>
            <td>{r.length}</td><td>{r.width}</td><td>{r.thickness}</td><td>{r.material}</td><td>{r.notes.join('; ')}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td colSpan={3}>Total parts</td><td>{total}</td><td colSpan={5} /></tr>
      </tfoot>
    </table>
  );
}
```

- [ ] **Step 3: Wire into src/App.tsx**

Replace the `<main>` block with:

```tsx
        <main className="content">
          {tab === '3d' && <div className="placeholder">3D view</div>}
          {(tab === 'front' || tab === 'plan' || tab === 'side') && <View2D tab={tab} />}
          {tab === 'cutlist' && <CutListTable />}
        </main>
```

and add the imports:

```tsx
import { View2D } from './ui/View2D';
import { CutListTable } from './ui/CutListTable';
```

- [ ] **Step 4: Verify manually**

Run: `pnpm typecheck && pnpm build && pnpm dev`. Check:
- Front tab: dashed envelope triangle, four columns with filled doors/drawer fronts, dims below and heights at boundaries, "slope 26.6 deg" above. Switching "Tall side" to Right mirrors the drawing and labels stay readable.
- Plan tab: front at the bottom, depth dims at the right.
- Side tab: rectangle envelope, section of column 1 with rod circle.
- Cut list tab: 4 drawer fronts of column 3 grouped as qty 4; total parts 39.
- Type an invalid value (Height min 5000): the 2D views keep the last valid drawing.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: 2D view tabs and cut list table"
```

---

### Task 14: 3D viewport

**Files:**
- Create: `src/ui/three/PartMesh.tsx`, `src/ui/three/EnvelopeMesh.tsx`, `src/ui/three/Viewport3D.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Part`, `buildParts` (Task 5); `layoutColumns` (Task 4); `useStore` (Task 11); `setSnapshotter` (Task 12).
- Produces: `Viewport3D()`, `PartMesh({ part, explode })`, `EnvelopeMesh({ envelope })`.
- Mesh matrix = `Rz * Ry * Rx` then translation, identical to `toWorld` in Task 3. `matrixAutoUpdate={false}`.
- Camera stands at negative Z looking into the closet (front opening at z = 0).

- [ ] **Step 1: Write src/ui/three/PartMesh.tsx**

```tsx
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Part, PartKind } from '../../geometry/parts';

const COLORS: Record<PartKind, string> = {
  side: '#d9c7a3', top: '#d9c7a3', bottom: '#d9c7a3', shelf: '#e3d5b8', back: '#c9b48e',
  door: '#a9c4d6', drawerFront: '#9fbbd0', fixedFront: '#b8cbd9', plinth: '#8a7a5e', rod: '#8c8c8c',
};

function explodeOffset(kind: PartKind, f: number): THREE.Vector3 {
  const o = new THREE.Vector3();
  switch (kind) {
    case 'door': case 'drawerFront': case 'fixedFront': o.z = -400 * f; break;
    case 'top': o.y = 300 * f; break;
    case 'back': o.z = 300 * f; break;
    case 'plinth': o.y = -150 * f; break;
    case 'shelf': o.z = -150 * f; break;
    default: break;
  }
  return o;
}

export function PartMesh({ part, explode }: { part: Part; explode: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    part.outline.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false });
  }, [part.outline, part.thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const matrix = useMemo(() => {
    const { position: p, rotation: r } = part.transform;
    const m = new THREE.Matrix4().makeRotationX(r.x);
    m.premultiply(new THREE.Matrix4().makeRotationY(r.y));
    m.premultiply(new THREE.Matrix4().makeRotationZ(r.z));
    const o = explodeOffset(part.kind, explode);
    m.setPosition(p.x + o.x, p.y + o.y, p.z + o.z);
    return m;
  }, [part, explode]);

  return (
    <mesh geometry={geometry} matrix={matrix} matrixAutoUpdate={false}>
      <meshStandardMaterial color={COLORS[part.kind]} side={THREE.DoubleSide} />
    </mesh>
  );
}
```

- [ ] **Step 2: Write src/ui/three/EnvelopeMesh.tsx**

```tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { Envelope } from '../../model/types';

export function EnvelopeMesh({ envelope: e }: { envelope: Envelope }) {
  const { length: L, heightMax: H, heightMin: h, depth: D } = e;
  const slope = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([0, H, 0, L, h, 0, L, h, D, 0, H, 0, L, h, D, 0, H, D]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, [L, H, h, D]);
  const front: [number, number, number][] = [[0, 0, 0], [L, 0, 0], [L, h, 0], [0, H, 0], [0, 0, 0]];
  const back: [number, number, number][] = [[0, 0, D], [L, 0, D], [L, h, D], [0, H, D], [0, 0, D]];
  return (
    <group>
      <mesh geometry={slope}>
        <meshStandardMaterial color="#7fa7d1" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, -1, D / 2]}>
        <planeGeometry args={[L, D]} />
        <meshStandardMaterial color="#e2e2e2" side={THREE.DoubleSide} />
      </mesh>
      <Line points={front} color="#555" lineWidth={1} />
      <Line points={back} color="#555" lineWidth={1} dashed dashSize={40} gapSize={25} />
      <Line points={[[0, H, 0], [0, H, D]]} color="#555" lineWidth={1} />
      <Line points={[[L, h, 0], [L, h, D]]} color="#555" lineWidth={1} />
      <Line points={[[L, 0, 0], [L, 0, D]]} color="#555" lineWidth={1} />
    </group>
  );
}
```

- [ ] **Step 3: Write src/ui/three/Viewport3D.tsx**

```tsx
import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useStore } from '../../store/store';
import { buildParts } from '../../geometry/parts';
import { layoutColumns } from '../../geometry/column';
import { setSnapshotter } from '../snapshot';
import { PartMesh } from './PartMesh';
import { EnvelopeMesh } from './EnvelopeMesh';

function SnapshotBridge() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    setSnapshotter(() => gl.domElement.toDataURL('image/png'));
    return () => setSnapshotter(null);
  }, [gl]);
  return null;
}

function CameraFit({ length, height, depth }: { length: number; height: number; depth: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const r = Math.max(length, height, depth);
    camera.position.set(length / 2 + r * 0.3, height * 0.8, -r * 1.6);
    camera.near = 10;
    camera.far = r * 20;
    camera.lookAt(length / 2, height / 2, depth / 2);
    camera.updateProjectionMatrix();
  }, [camera, length, height, depth]);
  return null;
}

export function Viewport3D() {
  const project = useStore((s) => s.lastValid);
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  const parts = useMemo(() => buildParts(project), [project]);
  const cols = useMemo(() => layoutColumns(project), [project]);
  const env = project.envelope;
  const mirror = env.tallSide === 'right';
  return (
    <div className="viewport">
      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ fov: 45 }} style={{ background: '#f0f2f5' }}>
        <CameraFit length={env.length} height={env.heightMax} depth={env.depth} />
        <SnapshotBridge />
        <ambientLight intensity={0.7} />
        <directionalLight position={[-1000, 3000, -2000]} intensity={1.2} />
        <directionalLight position={[2000, 1000, 2000]} intensity={0.4} />
        <group scale={[mirror ? -1 : 1, 1, 1]} position={[mirror ? env.length : 0, 0, 0]}>
          {ui.showEnvelope && <EnvelopeMesh envelope={env} />}
          {parts.map((p) => <PartMesh key={p.id} part={p} explode={ui.explode} />)}
          {ui.showDims && cols.map((L) => (
            <group key={L.index}>
              <Html position={[(L.x0 + L.x1) / 2, -60, -100]} center><div className="dim3d">{L.width}</div></Html>
              <Html position={[L.x1, L.hLow + 60, -100]} center><div className="dim3d">{Math.round(L.hLow)}</div></Html>
              {L.index === 0 && (
                <Html position={[L.x0, L.hTall + 60, -100]} center><div className="dim3d">{Math.round(L.hTall)}</div></Html>
              )}
            </group>
          ))}
        </group>
        <OrbitControls makeDefault target={[env.length / 2, env.heightMax / 2, env.depth / 2]} />
      </Canvas>
      <div className="controls">
        <label><input type="checkbox" checked={ui.showDims} onChange={(e) => setUi({ showDims: e.target.checked })} /> Dims</label>
        <label><input type="checkbox" checked={ui.showEnvelope} onChange={(e) => setUi({ showEnvelope: e.target.checked })} /> Envelope</label>
        <label>Explode <input type="range" min={0} max={1} step={0.05} value={ui.explode} onChange={(e) => setUi({ explode: e.target.valueAsNumber })} /></label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into src/App.tsx**

Replace `{tab === '3d' && <div className="placeholder">3D view</div>}` with `{tab === '3d' && <Viewport3D />}` and add `import { Viewport3D } from './ui/three/Viewport3D';`. Remove the `.placeholder` CSS rule if nothing else uses it.

- [ ] **Step 5: Verify manually**

Run: `pnpm typecheck && pnpm build && pnpm dev`. Check:
- 3D tab shows four carcasses under a translucent sloped plane, doors on columns 1-2, drawer fronts and a triangular fixed front on 3-4, a rod in column 1, plinths set back. Left column tallest.
- Orbit/zoom works; the camera refits when Length changes.
- Dims toggle shows width and height labels; Envelope toggle hides the plane and floor; Explode slider pulls fronts forward and tops up.
- Tall side = Right mirrors the scene.
- With the 3D tab open, Export PDF: page 1 contains the 3D snapshot. From another tab, page 1 shows the "open the 3D tab" note instead.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: 3D viewport with explode, dims and snapshot"
```

---

### Task 15: Final verification and README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run the full verification**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: typecheck clean, all vitest suites pass (envelope, validate, vec, column, parts, cutlist, ir, views, svg, pdf, exportPdf, store), `dist/` built.

- [ ] **Step 2: Manual end-to-end pass**

Run `pnpm dev` and do one complete flow: New → change Length 3000 → Add column → set column 5 to Drawers x3 → open 3D → Export PDF. Open the PDF and confirm: summary with snapshot; front/plan/side pages each with a "Scale 1:N" footer; five column detail pages; cut list pages ending with "Total parts: N" where N matches the Cut list tab.

- [ ] **Step 3: Write README.md**

```markdown
# Under-stairs closet planner

Browser-based planner for a fitted cabinet inside an under-stairs closet.
Enter the closet envelope and the cabinet columns; get a 3D preview,
dimensioned 2D views and a PDF scheme with a cut list. Runs entirely locally;
the project autosaves to localStorage and can be exported/imported as JSON.

## Develop

    pnpm install
    pnpm dev        # http://localhost:5173
    pnpm test       # vitest
    pnpm typecheck
    pnpm build      # dist/

## Layout

- `src/model` types, defaults, validation
- `src/geometry` envelope math, column layout, `Part[]` builder
- `src/cutlist`, `src/drawing`, `src/render`, `src/pdf` pure outputs derived from `Part[]`
- `src/store` zustand store, persistence
- `src/ui` React components (3D viewport under `src/ui/three`)

Design spec: `docs/superpowers/specs/2026-09-07-understairs-closet-planner-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README"
```
