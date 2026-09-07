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
    expect(texts(d)).toContain('slope 26.6°');
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

describe('russian views', () => {
  const p = defaultProject();
  it('translate titles and labels', () => {
    expect(frontView(p, 'ru').title).toBe('Фасад');
    expect(texts(frontView(p, 'ru'))).toContain('уклон 26.6°');
    expect(planView(p, 'ru').title).toBe('План');
    expect(sideView(p, 'ru').title).toBe('Разрез (высокая сторона)');
    const d = columnDetail(p, 1, 'ru');
    expect(d.title).toBe('Секция 2 — деталировка');
    expect(texts(d)).toContain('Фасад');
    expect(hasDim(d, 564)).toBe(true); // geometry unchanged
  });
});
