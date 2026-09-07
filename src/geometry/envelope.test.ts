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
