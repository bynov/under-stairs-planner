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
