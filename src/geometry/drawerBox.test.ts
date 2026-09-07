import { describe, it, expect } from 'vitest';
import { drawerBoxes } from './drawerBox';
import { layoutColumns } from './column';
import { defaultProject } from '../model/defaults';

describe('drawerBoxes', () => {
  const p = defaultProject();
  const L = layoutColumns(p);
  it('overlay column: one box per front, centred with runner clearance, from the carcass front', () => {
    const boxes = drawerBoxes(L[2], p.cabinet);
    expect(boxes).toHaveLength(4);
    const b = boxes[0], f = L[2].drawerFronts[0];
    expect(b.x0).toBe(1300 + 18 + 13);
    expect(b.x1).toBe(1900 - 18 - 13);
    expect(b.y0).toBeCloseTo(100 + f.y0 + 10, 8);
    expect(b.y1).toBeCloseTo(100 + f.y1 - 10, 8);
    expect(b.y1 - b.y0).toBeCloseTo(f.y1 - f.y0 - 20, 8);
    expect(b.z0).toBe(0);
    expect(b.z1).toBe(596 - 20);
  });
  it('internal column: box starts behind the internal front (z = t)', () => {
    const boxes = drawerBoxes(L[3], p.cabinet);
    expect(boxes).toHaveLength(3);
    expect(boxes[0].z0).toBe(18);
    expect(boxes[0].x0).toBe(1900 + 31);
  });
  it('shelf columns have no boxes', () => {
    expect(drawerBoxes(L[0], p.cabinet)).toEqual([]);
  });
});
