# Column Interior / Door Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Column.front` with a mutually exclusive `interior` (shelves | drawers) plus an independent `door` flag, build internal drawers behind a door, migrate v1 JSON, and show the free width next to "Add column".

**Architecture:** Model change in `src/model` with a v1→v2 migration in `persist.ts`; layout computes overlay vs internal drawer geometry; parts/drawings/PDF/UI consume the new layout fields. Geometry for unchanged configurations (shelves+door, open shelves, overlay drawers) must produce identical numbers.

**Tech Stack:** existing (TS strict, vitest, React 18, zustand, jsPDF, r3f). Builds on the i18n work (`t`, `Msg`, dictionaries in `src/i18n`).

**Spec:** `docs/superpowers/specs/2026-09-07-understairs-closet-planner-design.md` (§2.2 Column, §2.4 contents, §2.5, §3.2 front view hidden lines, §3.6 JSON v2, §4 UI)

## Global Constraints

- `Column { id, width, interior: 'shelves' | 'drawers', shelves, drawerCount, door: boolean, rod: boolean }`. Shelves/rod apply only when `interior = shelves`; `drawerCount >= 1` only when `interior = drawers`.
- Migration v1→v2: `front: 'none'` → `{ interior: 'shelves', door: false }`, `'door'` → `{ interior: 'shelves', door: true }`, `'drawers'` → `{ interior: 'drawers', door: false }`; other fields copied. `FILE_VERSION = 2`; `parseProjectShape` accepts version 1 (migrates) or 2.
- Overlay drawers (`door = false`): fronts x from `REVEAL` to `w − REVEAL`, gaps `DRAWER_GAP = 3`, z `−t..0`. Under a sloped top the triangle above `hLow` is an **open shelf**: `topShelfY = floorY + interiorHeight` (absolute top surface of a shelf board between the sides, capped by the top panel's underside at the inner face — not the outer surface `hLow` — `SHELF_SETBACK` from the front, nameKey `shelf`, part id `col<i>-topShelf`), and the front zone is `REVEAL .. topShelfY − plinth − t − REVEAL`. Under a stepped top: no top shelf, zone `REVEAL .. hLow − plinth − REVEAL`. The fixed front panel is removed entirely (kind, nameKey, i18n key `part.fixedFront`, colour, explode case, cut-list order).
- Internal drawers (`door = true`): x from `t + DRAWER_GAP` to `w − t − DRAWER_GAP`; y zone from `t + DRAWER_GAP` to `t + interiorHeight − DRAWER_GAP` (column-local, origin at plinth top); z `0..t`; no top shelf; note `note.internalFront`.
- Door outline unchanged (column front outline inset by `REVEAL`), for any interior when `door = true`.
- Front elevation: contents behind a door (shelves, rod, internal drawer fronts) drawn `dashed`, unfilled.
- Default project columns: 700 shelves 0 + door + rod; 600 shelves 3 + door; 600 drawers ×4 no door; 600 drawers ×3 + door.
- "Add column" shows `ui.freeWidth` (`envelope.length − Σ widths`) and is disabled when that is below `2·panelThickness + 100`.
- i18n keys: remove `ui.front`, `ui.front.none`, `ui.front.door`, `ui.front.drawers`, `part.fixedFront`; add `ui.interior`, `ui.interior.shelves`, `ui.interior.drawers`, `ui.door`, `ui.freeWidth`, `pdf.withDoor`, `note.internalFront` to BOTH dictionaries.
- No per-task commits; one unsigned commit at the end. `pnpm typecheck && pnpm test && pnpm build` after every task.

## File Structure

```
src/model/types.ts, defaults.ts, validate.ts   Column model
src/store/persist.ts                          FILE_VERSION 2, migrateProject, shape check
src/i18n/en.ts, ru.ts                         key changes
src/geometry/column.ts                        DrawerFront {x0,x1,y0,y1}, drawerStyle, contents rules
src/geometry/parts.ts                         internal drawer placement + note
src/drawing/column.ts                         hidden-line rendering behind doors; section z for internal fronts
src/pdf/exportPdf.ts                          summary descriptor
src/ui/ColumnCard.tsx, Sidebar.tsx            fields; free width
src/ui/three/PartMesh.tsx                     explode offsets
tests alongside
```

---

### Task 1: Model, migration, dictionary keys

**Files:**
- Modify: `src/model/types.ts`, `src/model/defaults.ts`, `src/model/validate.ts`, `src/store/persist.ts`, `src/i18n/en.ts`, `src/i18n/ru.ts`, and any compile-breaking consumer (`src/geometry/column.ts`, `src/drawing/column.ts`, `src/pdf/exportPdf.ts`, `src/ui/ColumnCard.tsx`) with the minimal change that keeps today's behaviour for migrated data (`col.front === 'door'` → `col.door`, `col.front === 'drawers'` → `col.interior === 'drawers'`, `col.front === 'none'` → `!col.door`).
- Test: `src/store/store.test.ts` (add migration tests), `src/model/validate.test.ts` (unchanged expectations must still pass)

**Interfaces:**
- Produces: new `Column` type; `migrateProject(data: unknown): unknown` (v1 → v2 object); `FILE_VERSION = 2`; new i18n keys.

- [ ] **Step 1: Add failing tests to src/store/store.test.ts ("persist" block)**

```ts
  it('migrates version 1 files (front -> interior/door)', () => {
    const v1 = {
      version: 1,
      project: {
        ...defaultProject(),
        cabinet: {
          ...defaultProject().cabinet,
          columns: [
            { id: 'a', width: 600, front: 'none', shelves: 2, drawerCount: 3, rod: true },
            { id: 'b', width: 600, front: 'door', shelves: 0, drawerCount: 3, rod: false },
            { id: 'c', width: 600, front: 'drawers', shelves: 0, drawerCount: 4, rod: false },
          ],
        },
      },
    };
    const r = parseProjectJson(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const c = r.project.cabinet.columns;
      expect(c[0]).toEqual({ id: 'a', width: 600, interior: 'shelves', shelves: 2, drawerCount: 3, door: false, rod: true });
      expect(c[1]).toMatchObject({ interior: 'shelves', door: true });
      expect(c[2]).toMatchObject({ interior: 'drawers', door: false, drawerCount: 4 });
      expect(serializeProject(r.project)).toContain('"version": 2');
    }
  });
  it('rejects a v2 file with the old front field', () => {
    const p = defaultProject() as unknown as { cabinet: { columns: Record<string, unknown>[] } };
    const col = p.cabinet.columns[0];
    delete col.interior; delete col.door; col.front = 'door';
    expect(parseProjectJson(JSON.stringify({ version: 2, project: p })).ok).toBe(false);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/store/store.test.ts`
Expected: FAIL (migration missing; version 1 currently rejected once `FILE_VERSION` becomes 2, and v1 shape lacks `interior`).

- [ ] **Step 3: Update src/model/types.ts**

```ts
export type Interior = 'shelves' | 'drawers';

export interface Column {
  id: string;
  width: number;
  interior: Interior;   // mutually exclusive contents
  shelves: number;      // when interior = shelves; 0 = empty
  drawerCount: number;  // when interior = drawers, >= 1
  door: boolean;        // a door in front of the contents
  rod: boolean;         // only when interior = shelves
}
```
Remove `FrontKind` (and its export) — grep for uses and replace.

- [ ] **Step 4: Update src/model/defaults.ts**

```ts
export function defaultColumn(width = 500): Column {
  return { id: newColumnId(), width, interior: 'shelves', shelves: 0, drawerCount: 3, door: true, rod: false };
}
// defaultProject columns:
        { ...defaultColumn(700), rod: true },
        { ...defaultColumn(600), shelves: 3 },
        { ...defaultColumn(600), interior: 'drawers', drawerCount: 4, door: false },
        { ...defaultColumn(600), interior: 'drawers', drawerCount: 3, door: true },
```

- [ ] **Step 5: Update src/model/validate.ts**

`if (c.front === 'drawers' && !(c.drawerCount >= 1))` → `if (c.interior === 'drawers' && !(c.drawerCount >= 1))`.

- [ ] **Step 6: Update src/store/persist.ts**

```ts
export const FILE_VERSION = 2;

/** Upgrade a parsed planner file object to the current version. Unknown input is returned as-is. */
export function migrateProject(data: unknown): unknown {
  if (!isObj(data) || data.version !== 1 || !isObj(data.project)) return data;
  const project = data.project;
  const cabinet = isObj(project.cabinet) ? project.cabinet : null;
  if (!cabinet || !Array.isArray(cabinet.columns)) return data;
  const columns = cabinet.columns.map((c: unknown) => {
    if (!isObj(c)) return c;
    const { front, ...rest } = c;
    const interior = front === 'drawers' ? 'drawers' : 'shelves';
    const door = front === 'door';
    return { ...rest, interior, door };
  });
  return { version: FILE_VERSION, project: { ...project, cabinet: { ...cabinet, columns } } };
}
```
In `isProjectShape`, the column predicate becomes:
```ts
      isObj(col) && typeof col.id === 'string' && isNum(col.width) &&
      (col.interior === 'shelves' || col.interior === 'drawers') &&
      isNum(col.shelves) && isNum(col.drawerCount) && typeof col.door === 'boolean' && typeof col.rod === 'boolean',
```
In `parseProjectShape`, after `JSON.parse`: `data = migrateProject(data);` then the existing version check (`data.version !== FILE_VERSION` → `error.badVersion`).

- [ ] **Step 7: Dictionary keys**

In `src/i18n/en.ts` remove `'ui.front'`, `'ui.front.none'`, `'ui.front.door'`, `'ui.front.drawers'`; add
```ts
  'ui.interior': 'Interior',
  'ui.interior.shelves': 'Shelves',
  'ui.interior.drawers': 'Drawers',
  'ui.door': 'Door',
  'ui.freeWidth': 'Free width: {n} mm',
  'pdf.withDoor': 'door',
  'note.internalFront': 'internal',
```
In `src/i18n/ru.ts` likewise:
```ts
  'ui.interior': 'Наполнение',
  'ui.interior.shelves': 'Полки',
  'ui.interior.drawers': 'Ящики',
  'ui.door': 'Дверь',
  'ui.freeWidth': 'Свободно: {n} мм',
  'pdf.withDoor': 'дверь',
  'note.internalFront': 'внутренний',
```

- [ ] **Step 8: Minimal consumer fixes so the gate passes**

`src/geometry/column.ts`: `col.front === 'door'` → `col.door` (door outline), `else if (col.front === 'drawers')` → `if (col.interior === 'drawers')` (make the two independent `if`s), rod condition → `col.rod && col.interior === 'shelves'`, shelves: `const shelfCount = col.interior === 'shelves' ? col.shelves : 0;` used for pitch and `shelfYs`. `src/drawing/column.ts`: `L.column.front === 'none'` → `!L.column.door`. `src/pdf/exportPdf.ts` summary: `t(lang, \`ui.interior.${c.interior}\` as MessageKey)`, drawers count when `c.interior === 'drawers'`, shelves count when `c.interior === 'shelves' && c.shelves`, `c.door ? t(lang, 'pdf.withDoor') : ''`, rod when `c.rod && c.interior === 'shelves'`. `src/ui/ColumnCard.tsx`: temporarily map the select to `interior` with options `ui.interior.*` and add a `CheckField` for `ui.door` (Task 4 finalises the card). Update any test that sets `front` (grep `front:` in `src/**/*.test.ts`) to the new fields with the same meaning.

- [ ] **Step 9: Gate**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: PASS; existing geometry tests unchanged (overlay drawers and door columns produce the same numbers).

---

### Task 2: Layout and parts for internal drawers

**Files:**
- Modify: `src/geometry/column.ts`, `src/geometry/parts.ts`
- Test: `src/geometry/column.test.ts`, `src/geometry/parts.test.ts`

**Interfaces:**
- Produces: `DrawerFront { x0, x1, y0, y1 }` (column-local, origin at `(x0, plinthHeight)`), `ColumnLayout.drawerStyle: 'overlay' | 'internal' | null`, `ColumnLayout.topShelfY: number | null` (absolute); `fixedFront` field removed; `PartKind`/`PartNameKey` lose `'fixedFront'`.

- [ ] **Step 1: Update tests**

`src/geometry/column.test.ts`:
- Rewrite "drawer fronts fill plinth-top..hLow with reveals and gaps" (column 2, overlay, hLow 1230):
```ts
    const c = L[2];
    expect(c.drawerStyle).toBe('overlay');
    expect(c.topShelfY).toBe(1230);
    expect(c.drawerFronts).toHaveLength(4);
    const zoneTop = 1230 - 100 - 18 - 2; // 1110: below the top shelf's underside minus the reveal
    const h = (zoneTop - 2 - 3 * 3) / 4;  // 274.75
    expect(c.drawerFronts[0]).toEqual({ x0: 2, x1: 598, y0: 2, y1: 2 + h });
    expect(c.drawerFronts[3].y1).toBeCloseTo(zoneTop, 8);
    expect(c.drawerFronts[1].y0 - c.drawerFronts[0].y1).toBeCloseTo(3, 8);
```
- Replace the "fixed front is the triangle above the drawers" test with:
```ts
  it('no top shelf under a stepped top; zone runs to hLow - reveal', () => {
    const p = defaultProject(); p.cabinet.topStyle = 'stepped';
    const c = layoutColumns(p)[2];
    expect(c.topShelfY).toBeNull();
    expect(c.drawerFronts[3].y1).toBeCloseTo(1230 - 100 - 2, 8);
  });
```
- In the stepped describe, drop the `fixedFront` assertion.
- Add:
```ts
  it('internal drawers behind a door fill the interior with 3 mm gaps', () => {
    const c = L[3]; // 600 wide, drawers x3, door
    expect(c.drawerStyle).toBe('internal');
    expect(c.doorOutline).not.toBeNull();
    expect(c.topShelfY).toBeNull();
    expect(c.drawerFronts).toHaveLength(3);
    const zoneBot = 18 + 3, zoneTop = 18 + c.interiorHeight - 3;
    const h = (zoneTop - zoneBot - 2 * 3) / 3;
    expect(c.drawerFronts[0]).toEqual({ x0: 21, x1: 579, y0: zoneBot, y1: zoneBot + h });
    expect(c.drawerFronts[2].y1).toBeCloseTo(zoneTop, 8);
    expect(c.shelfYs).toEqual([]);
    expect(c.rodY).toBeNull();
  });
  it('ignores shelves and rod for drawer columns, and drawers for shelf columns', () => {
    const p = defaultProject();
    p.cabinet.columns[2].shelves = 4; p.cabinet.columns[2].rod = true;
    p.cabinet.columns[1].drawerCount = 5;
    const M = layoutColumns(p);
    expect(M[2].shelfYs).toEqual([]); expect(M[2].rodY).toBeNull();
    expect(M[1].drawerFronts).toEqual([]); expect(M[1].drawerStyle).toBeNull();
  });
```
`src/geometry/parts.test.ts`:
- "creates the expected part count": comments become `col2: 6 + 4 drawers + top shelf = 11`, `col3: 6 + door + 3 internal drawers = 10`; total stays 39; add `expect(byId('col3-door')).toBeDefined(); expect(parts.some((x) => x.kind === 'fixedFront' as string)).toBe(false);`.
- Rewrite "drawer fronts and fixed front" as "drawer fronts and open top shelf": keep the column-2 front assertions (`x 1302..1898`, `min.y 102`), replace the fixed-front lines with
```ts
    const shelf = byId('col2-topShelf');
    const sb = partBounds(shelf);
    near(sb.max.y, 1230); near(sb.min.y, 1212);
    near(sb.min.x, 1318); near(sb.max.x, 1882);
    near(sb.min.z, 20); near(sb.max.z, 596);
    expect(shelf.nameKey).toBe('shelf'); expect(shelf.index).toBeUndefined();
```
  and change the shelves count assertion `parts.filter((x) => x.kind === 'shelf')` to `toHaveLength(4)` (3 in column 2 + the top shelf).
- Remove the stepped-top assertion `expect(parts.find((x) => x.id === 'col2-fixedFront')).toBeUndefined()`.
- Add:
```ts
  it('internal drawer fronts sit inside the carcass flush with its front', () => {
    const d = parts.filter((x) => x.columnIndex === 3 && x.kind === 'drawerFront');
    expect(d).toHaveLength(3);
    const b = partBounds(d[0]);
    near(b.min.z, 0); near(b.max.z, 18);
    near(b.min.x, 1900 + 21); near(b.max.x, 2500 - 21);
    near(b.min.y, 100 + 21);
    expect(d[0].notes).toEqual([{ key: 'note.internalFront' }]);
  });
```

- [ ] **Step 2: Run to verify failures**

Run: `pnpm vitest run src/geometry/column.test.ts src/geometry/parts.test.ts`
Expected: FAIL (`x0/x1`, `drawerStyle`, internal placement).

- [ ] **Step 3: Update src/geometry/column.ts**

```ts
export interface DrawerFront { x0: number; x1: number; y0: number; y1: number } // column-local (origin at x0, plinth top)
export type DrawerStyle = 'overlay' | 'internal';
// in ColumnLayout (fixedFront removed):
  drawerFronts: DrawerFront[];
  drawerStyle: DrawerStyle | null;
  topShelfY: number | null;   // absolute top surface of the open shelf above overlay drawers (sloped top only)
```
Contents section of `layoutColumn`:
```ts
  const shelfCount = col.interior === 'shelves' ? col.shelves : 0;
  const shelfPitch = interiorHeight / (shelfCount + 1);
  const shelfYs = Array.from({ length: shelfCount }, (_, k) => floorY + (k + 1) * shelfPitch);

  const frontTop = (lx: number) => topY(lx) - plinth;
  const R = REVEAL, G = DRAWER_GAP;

  const doorOutline: Vec2[] | null = col.door
    ? [v2(R, R), v2(w - R, R), v2(w - R, frontTop(w - R) - R), v2(R, frontTop(R) - R)]
    : null;

  let drawerFronts: DrawerFront[] = [];
  let drawerStyle: DrawerStyle | null = null;
  let topShelfY: number | null = null;
  if (col.interior === 'drawers') {
    const n = col.drawerCount;
    drawerStyle = col.door ? 'internal' : 'overlay';
    if (!col.door && sloped) topShelfY = r.hLow;           // open shelf in the triangle above the drawers
    const x0 = col.door ? t + G : R;
    const x1 = col.door ? w - t - G : w - R;
    const zoneBot = col.door ? t + G : R;
    const zoneTop = col.door
      ? t + interiorHeight - G
      : r.hLow - plinth - (topShelfY !== null ? t : 0) - R;
    const h = (zoneTop - zoneBot - (n - 1) * G) / n;
    drawerFronts = Array.from({ length: n }, (_, i) => {
      const y0 = zoneBot + i * (h + G);
      return { x0, x1, y0, y1: y0 + h };
    });
  }

  const rodY = col.rod && col.interior === 'shelves' ? r.hLow - ROD_DROP : null;
```
Return `drawerStyle` and `topShelfY` alongside the other fields (drop `fixedFront`). Remove the now-unused `frontTop` usage only if nothing else references it (the door outline still does).

- [ ] **Step 4: Update src/geometry/parts.ts**

Remove `'fixedFront'` from `PartKind` and `PartNameKey` and delete the fixed-front block. Add the top shelf right after the regular shelves:
```ts
    if (L.topShelfY !== null) {
      add('topShelf', 'shelf', 'shelf', rect(L.interiorWidth, L.interiorDepth - SHELF_SETBACK), t, v3(x0 + t, L.topShelfY, SHELF_SETBACK), FLAT_ROT);
    }
```
Also remove `fixedFront` from `KIND_ORDER` in `src/cutlist/cutlist.ts`, from `COLORS` and `explodeOffset` in `src/ui/three/PartMesh.tsx`, and the `part.fixedFront` key from both dictionaries.
Drawer fronts:
```ts
    L.drawerFronts.forEach((d, k) => {
      const internal = L.drawerStyle === 'internal';
      add(`drawer${k + 1}`, 'drawerFront', 'drawerFront', rect(d.x1 - d.x0, d.y1 - d.y0), t,
        v3(x0 + d.x0, plinth + d.y0, internal ? 0 : -t), NO_ROT, 'panel',
        internal ? [msg('note.internalFront')] : undefined, k + 1);
    });
```

- [ ] **Step 5: Gate**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: PASS. Cut-list tests: column 3's three internal fronts group into one row with the `note.internalFront` note (adjust `src/cutlist/cutlist.test.ts` only if an assertion counted column-4 fronts).

---

### Task 3: Drawings and PDF summary

**Files:**
- Modify: `src/drawing/column.ts`, `src/drawing/views.test.ts`, `src/pdf/exportPdf.ts` (descriptor already switched in Task 1 — verify)

- [ ] **Step 1: Update tests in src/drawing/views.test.ts**

Replace the "draws filled fronts and dashed envelope" expectations:
```ts
    const polys = d.prims.filter((q): q is Extract<Prim, { t: 'poly' }> => q.t === 'poly');
    expect(polys.filter((q) => q.fill === 'panel')).toHaveLength(3 + 4); // 3 doors, 4 overlay fronts
    expect(polys.filter((q) => q.stroke === 'dashed' && q.fill !== 'panel').length).toBeGreaterThanOrEqual(1 + 3 + 3); // envelope, 3 internal fronts, 3 shelves behind a door
```
Add to `columnDetail` tests:
```ts
  it('internal drawers are drawn dashed behind the door in the front and inside the carcass in the section', () => {
    const d = columnDetail(p, 3);
    const polys = d.prims.filter((q): q is Extract<Prim, { t: 'poly' }> => q.t === 'poly');
    expect(polys.filter((q) => q.stroke === 'dashed')).toHaveLength(3);
    expect(polys.filter((q) => q.fill === 'panel')).toHaveLength(1 + 1 + 3); // door (front), door (section), 3 fronts (section)
    const sectionFronts = polys.filter((q) => q.fill === 'panel' && q.pts[0].x >= L[3].width); // section is to the right
    expect(sectionFronts.some((q) => q.pts[1].x - q.pts[0].x === 18 && q.pts[0].x > L[3].width + 100)).toBe(true);
  });
```
(`L` = `layoutColumns(p)` already in that describe.)

- [ ] **Step 2: Run to verify failures**

Run: `pnpm vitest run src/drawing/views.test.ts`

- [ ] **Step 3: Update src/drawing/column.ts**

`columnFrontPrims` contents:
```ts
  const hidden = !!L.doorOutline;                 // contents behind a door -> hidden lines
  const stroke = hidden ? 'dashed' : 'thin';
  const fill = hidden ? 'none' : 'panel';
  if (L.doorOutline) out.push(poly(L.doorOutline.map(sh), 'thin', 'panel'));
  for (const d of L.drawerFronts) out.push(rectPrim(x0 + d.x0, pl + d.y0, d.x1 - d.x0, d.y1 - d.y0, stroke, fill));
  for (const y of L.shelfYs) out.push(rectPrim(x0 + t, y - t, L.interiorWidth, t, stroke));
  if (L.topShelfY !== null) out.push(rectPrim(x0 + t, L.topShelfY - t, L.interiorWidth, t));
  if (L.rodY !== null) out.push(line(v2(x0 + t, L.rodY), v2(x1 - t, L.rodY), 'dashed'));
```
(remove the old `if (L.column.front === 'none')` block). `columnSectionPrims`: draw the top shelf like the other shelves (`if (L.topShelfY !== null) out.push(rectPrim(dx + SHELF_SETBACK, L.topShelfY - t, L.interiorDepth - SHELF_SETBACK, t));`) and place drawer fronts by style:
```ts
  const fz = L.drawerStyle === 'internal' ? dx : dx - t;
  for (const d of L.drawerFronts) out.push(rectPrim(fz, pl + d.y0, t, d.y1 - d.y0, 'thin', 'panel'));
```

- [ ] **Step 4: Gate**

Run: `pnpm typecheck && pnpm test && pnpm build`

---

### Task 4: UI and 3D

**Files:**
- Modify: `src/ui/ColumnCard.tsx`, `src/ui/Sidebar.tsx`, `src/ui/three/PartMesh.tsx`, `src/styles.css`

- [ ] **Step 1: ColumnCard fields**

Order: Width; Interior (`SelectField` `ui.interior` with `ui.interior.shelves` / `ui.interior.drawers`, `onChange={(v) => set({ interior: v })}`); when shelves: `NumberField` `ui.shelves` (min 0, rounded) and `CheckField` `ui.rod`; when drawers: `NumberField` `ui.drawerCount` (min 1, rounded); then `CheckField` `ui.door` (`set({ door: v })`); derived line; buttons.

- [ ] **Step 2: Sidebar free width**

```tsx
  const used = cab.columns.reduce((s, c) => s + c.width, 0);
  const free = env.length - used;
  const minWidth = 2 * cab.panelThickness + 100;
  // ...
        <div className="row free">
          <span className="derived">{t('ui.freeWidth', { n: Number.isFinite(free) ? Math.round(free) : 0 })}</span>
          <button onClick={addColumn} disabled={!(free >= minWidth)}>{t('ui.addColumn')}</button>
        </div>
```
CSS: `.row.free { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }`.

- [ ] **Step 3: Explode offsets in PartMesh.tsx**

`case 'door': o.z = -500 * f; break;` and `case 'drawerFront': o.z = -300 * f; break;` (the `fixedFront` case is gone).

- [ ] **Step 4: Gate + dev-server check**

Run: `pnpm typecheck && pnpm test && pnpm build`; `pnpm dev` in background, curl `http://localhost:5173/src/ui/ColumnCard.tsx`, stop. Manual checks for the user: column 4 shows a door; Explode reveals three internal fronts; Front tab shows them dashed; free width reads "Free width: 100 mm" on the default project and the button is disabled; switching a column to Drawers hides the rod/shelves fields.

- [ ] **Step 5: Bug fix — envelope lines vanish when tall side = right**

`src/ui/three/Viewport3D.tsx` renders `<EnvelopeMesh>` inside `<group scale={[-1,1,1]}>` when `tallSide === 'right'`. A negative-determinant parent flips face winding, and three.js culls the screen-space quads of drei `Line` (`Line2`/`LineMaterial`, single-sided), so all envelope edges — including the dashed back wall — disappear. Fix: render the envelope **outside** the mirrored group and mirror its coordinates in data.

`EnvelopeMesh` gets a `mirror: boolean` prop; inside, `const mx = (x: number) => (mirror ? L - x : x);` and every X coordinate in the slope geometry (`0`→`mx(0)`, `L`→`mx(L)`), the floor plane position (`L / 2` stays), and the `front`/`back`/vertical edge point lists uses `mx(...)`. In `Viewport3D`, move `{ui.showEnvelope && <EnvelopeMesh envelope={env} mirror={mirror} />}` out of the mirrored `<group>` (keep parts and dim labels inside). Add a comment on the group explaining why the envelope is outside.

Verification (no browser): typecheck/build, and a note in the report; user checks: switch Tall side to Right — envelope edges and the dashed back wall remain visible, cabinet mirrored.
