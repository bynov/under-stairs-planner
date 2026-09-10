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
    // col0: 6 carcass + door + rod + top shelf = 9; col1: 6 + door + 3 shelves = 10;
    // col2: 6 + 4 drawers + top shelf = 11; col3: 6 + door + 3 internal drawers = 10
    expect(parts).toHaveLength(40);
    expect(byId('col0-topShelf')).toBeDefined();
    // every column: sideL, sideR, bottom, top, back, plinth
    for (let i = 0; i < 4; i++) {
      for (const k of ['sideL', 'sideR', 'bottom', 'top', 'back', 'plinth']) expect(byId(`col${i}-${k}`)).toBeDefined();
    }
    expect(byId('col3-door')).toBeDefined();
    expect(parts.some((x) => x.kind === 'fixedFront' as string)).toBe(false);
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
    expect(parts.filter((x) => x.kind === 'shelf')).toHaveLength(5); // 3 + top shelves for col0 (rod) and col2 (drawers)
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
  it('drawer fronts and open top shelf', () => {
    const d = parts.filter((x) => x.columnIndex === 2 && x.kind === 'drawerFront');
    expect(d).toHaveLength(4);
    const b = partBounds(d[0]);
    near(b.min.x, 1302); near(b.max.x, 1898); near(b.min.y, 102);
    expect(d[1].nameKey).toBe('drawerFront');
    expect(d[1].index).toBe(2);
    const shelf = byId('col2-topShelf');
    const sb = partBounds(shelf);
    // topShelfY caps at the top panel's underside at the inner face (floorY + interiorHeight), not the outer hLow
    const topShelfY = 1530 - 582 * 0.5 - 18 / Math.cos(theta); // topUnderY(w - t), hTall 1530, lx 582
    near(sb.max.y, topShelfY); near(sb.min.y, topShelfY - 18);
    near(sb.min.x, 1318); near(sb.max.x, 1882);
    near(sb.min.z, 20); near(sb.max.z, 596);
    expect(shelf.nameKey).toBe('shelf'); expect(shelf.index).toBeUndefined();
  });
  it('internal drawer fronts sit inside the carcass flush with its front', () => {
    const d = parts.filter((x) => x.columnIndex === 3 && x.kind === 'drawerFront');
    expect(d).toHaveLength(3);
    const b = partBounds(d[0]);
    near(b.min.z, 0); near(b.max.z, 18);
    near(b.min.x, 1900 + 21); near(b.max.x, 2500 - 21);
    near(b.min.y, 100 + 21);
    expect(d[0].notes).toEqual([{ key: 'note.internalFront' }]);
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
