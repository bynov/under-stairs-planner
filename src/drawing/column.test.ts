import { describe, it, expect } from 'vitest';
import { columnSectionPrims } from './column';
import { layoutColumns } from '../geometry/column';
import { defaultProject } from '../model/defaults';
import type { Prim } from './ir';

describe('columnSectionPrims', () => {
  const p = defaultProject();
  const L = layoutColumns(p)[0];
  const t = p.cabinet.panelThickness, D = p.cabinet.depth, bt = p.cabinet.backThickness;

  const backRectHeight = (prims: Prim[]) => {
    const polys = prims.filter((q): q is Extract<Prim, { t: 'poly' }> => q.t === 'poly');
    const back = polys.find((q) => Math.abs(q.pts[0].x - (D - bt)) < 1e-6);
    return back!.pts[2].y - back!.pts[1].y;
  };

  it('back rect is L.backRightH tall on the low (right) side (F5)', () => {
    const prims = columnSectionPrims(L, p.cabinet, 0, 'right');
    expect(backRectHeight(prims)).toBeCloseTo(L.backRightH, 8);
  });

  it('back rect is L.backLeftH tall on the tall (left) side (F5)', () => {
    const prims = columnSectionPrims(L, p.cabinet, 0, 'left');
    expect(backRectHeight(prims)).toBeCloseTo(L.backLeftH, 8);
  });
});
