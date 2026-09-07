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
