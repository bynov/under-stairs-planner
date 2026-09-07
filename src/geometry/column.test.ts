import { describe, it, expect } from 'vitest';
import { layoutColumns, REVEAL } from './column';
import { defaultProject } from '../model/defaults';

const theta = Math.atan(0.5);
const topThick = 18 / Math.cos(theta); // 20.1246

describe('layoutColumns (default project, sloped)', () => {
  const L = layoutColumns(defaultProject());

  it('side heights differ: left at hTall, right at hLow, minus top thickness and plinth', () => {
    expect(L[0].topThick).toBeCloseTo(topThick, 4);
    expect(L[0].sideLeftH).toBeCloseTo(2180 - topThick - 100, 4);
    expect(L[0].sideRightH).toBeCloseTo(1830 + 9 - topThick - 100, 4);
  });
  it('interior dims', () => {
    expect(L[0].interiorWidth).toBe(664);
    expect(L[0].interiorDepth).toBe(596);
    expect(L[0].floorY).toBe(118);
    // interior height measured at the low side, inside the right side panel (x1 - t)
    expect(L[0].interiorHeight).toBeCloseTo(1830 + 9 - topThick - 118, 4);
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
    const c = L[2]; // hTall 1530, hLow 1230, w 600, 4 drawers, overlay
    expect(c.drawerStyle).toBe('overlay');
    // the open shelf can go no higher than the top panel's underside at the low side's inner face
    // (floorY + interiorHeight), not the outer top surface (hLow)
    const topShelfY = 1530 - 582 * 0.5 - topThick; // topUnderY(w - t) with hTall 1530, lx 582
    expect(c.topShelfY).toBeCloseTo(topShelfY, 8);
    expect(c.drawerFronts).toHaveLength(4);
    const zoneTop = topShelfY - 100 - 18 - 2; // below the top shelf's underside minus the reveal
    const h = (zoneTop - 2 - 3 * 3) / 4;
    expect(c.drawerFronts[0].x0).toBe(2); expect(c.drawerFronts[0].x1).toBe(598); expect(c.drawerFronts[0].y0).toBe(2);
    expect(c.drawerFronts[0].y1).toBeCloseTo(2 + h, 8);
    expect(c.drawerFronts[3].y1).toBeCloseTo(zoneTop, 8);
    expect(c.drawerFronts[1].y0 - c.drawerFronts[0].y1).toBeCloseTo(3, 8);
  });
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
  it('invariant: the open top shelf never sits inside the top panel and always clears the drawer zone', () => {
    for (const heightMin of [0, 300, 900, 1500]) {
      const p = defaultProject();
      p.envelope.heightMin = heightMin;
      const cols = layoutColumns(p);
      for (const c of cols) {
        if (c.topShelfY === null) continue;
        expect(c.topShelfY).toBeLessThanOrEqual(c.floorY + c.interiorHeight + 1e-9);
        const lastFront = c.drawerFronts[c.drawerFronts.length - 1];
        expect(c.topShelfY - p.cabinet.panelThickness)
          .toBeGreaterThanOrEqual(lastFront.y1 + p.cabinet.plinthHeight + REVEAL - 1e-9);
      }
    }
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
  it('door is a rectangle', () => {
    const d = L[0].doorOutline!;
    expect(d[2].y).toBe(d[3].y);
  });
  it('no top shelf under a stepped top; zone runs to hLow - reveal', () => {
    const p = defaultProject(); p.cabinet.topStyle = 'stepped';
    const c = layoutColumns(p)[2];
    expect(c.topShelfY).toBeNull();
    expect(c.drawerFronts[3].y1).toBeCloseTo(1230 - 100 - 2, 8);
  });
});
