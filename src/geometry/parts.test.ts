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
    expect(byId('col0-sideL').notes?.[0]).toEqual({ key: 'note.bevelTopEdge', params: { deg: 26.6 } });
  });
  it('right side occupies [x1-t, x1]', () => {
    const b = partBounds(byId('col1-sideR'));
    near(b.min.x, 1282); near(b.max.x, 1300);
    near(b.max.y, 1530 + 9 - 18 / Math.cos(theta));
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
    expect(top.notes?.[0]).toEqual({ key: 'note.bevelEndEdges', params: { deg: 26.6 } });
  });
  it('back is a trapezoid at the rear, between the sides', () => {
    const back = byId('col0-back');
    const b = partBounds(back);
    near(b.min.z, 596); near(b.max.z, 600);
    near(b.min.x, 18); near(b.max.x, 682);
    near(b.min.y, 118);
    expect(back.material).toBe('back');
    expect(back.outline[3].y).toBeGreaterThan(back.outline[2].y);
    expect(back.notes?.[0]?.key).toBe('note.trapezoid');
    expect(back.nameKey).toBe('back');
  });
  it('shelves are set back 20 mm and sit at shelfYs', () => {
    const s = byId('col1-shelf1');
    const b = partBounds(s);
    near(b.min.z, 20); near(b.max.z, 596);
    near(b.min.x, 718); near(b.max.x, 1282);
    expect(byId('col1-shelf3')).toBeDefined();
    expect(parts.filter((x) => x.kind === 'shelf')).toHaveLength(3);
    expect(s.nameKey).toBe('shelf');
    expect(s.index).toBe(1);
    expect(byId('col1-shelf3').index).toBe(3);
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
    expect(d[1].nameKey).toBe('drawerFront');
    expect(d[1].index).toBe(2);
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
    expect(rod.notes).toEqual([{ key: 'note.rodDia', params: { d: 25 } }]);
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
