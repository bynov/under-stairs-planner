import { describe, it, expect } from 'vitest';
import { buildCutList, partDims } from './cutlist';
import { buildParts } from '../geometry/parts';
import { defaultProject } from '../model/defaults';

describe('cut list', () => {
  it('groups identical parts across columns', () => {
    const p = defaultProject();
    p.cabinet.topStyle = 'stepped';
    p.cabinet.columns = [{ ...p.cabinet.columns[1], width: 600 }, { ...p.cabinet.columns[1], id: 'x', width: 600 }];
    const rows = buildCutList(buildParts(p));
    const bottom = rows.find((r) => r.nameKey === 'bottom')!;
    expect(bottom.qty).toBe(2);
    expect(bottom.columns).toEqual([1, 2]);
    expect(bottom.length).toBe(600);
    expect(bottom.width).toBe(564);
    expect(bottom.thickness).toBe(18);
    // sides differ in height between the two columns -> separate rows
    expect(rows.filter((r) => r.nameKey === 'sideL')).toHaveLength(2);
    // Side L and Side R stay separate rows even when their dims match (stepped top)
    expect(rows.filter((r) => r.nameKey === 'sideR')).toHaveLength(2);
  });
  it('groups identical drawer fronts within a column', () => {
    const rows = buildCutList(buildParts(defaultProject()));
    const fronts = rows.filter((r) => r.kind === 'drawerFront' && r.columns.includes(3));
    expect(fronts).toHaveLength(1);
    expect(fronts[0].qty).toBe(4);
    expect(fronts[0].length).toBe(596);
    expect(fronts[0].width).toBe(279.3);
    expect(fronts[0].nameKey).toBe('drawerFront');
  });
  it('lists rod as length x diameter and keeps notes', () => {
    const rows = buildCutList(buildParts(defaultProject()));
    const rod = rows.find((r) => r.kind === 'rod')!;
    expect(rod.length).toBe(664);
    expect(rod.width).toBe(25);
    expect(rod.thickness).toBe(25);
    expect(rod.material).toBe('rod');
    expect(rod.notes).toEqual([{ key: 'note.rodDia', params: { d: 25 } }]);
    const top = rows.find((r) => r.kind === 'top')!;
    expect(top.notes[0].key).toBe('note.bevelEndEdges');
  });
  it('orders rows by kind then name', () => {
    const rows = buildCutList(buildParts(defaultProject()));
    expect(rows[0].kind).toBe('side');
    expect(rows[rows.length - 1].kind).toBe('rod');
  });
  it('partDims uses the outline bounding box, longer edge first', () => {
    const part = buildParts(defaultProject()).find((x) => x.id === 'col0-sideL')!;
    const d = partDims(part);
    expect(d.length).toBeCloseTo(2059.9, 1);
    expect(d.width).toBe(600);
  });
});
