import type { Material, Part, PartKind } from '../geometry/parts';
import { bounds2 } from '../geometry/vec';
import { ROD_DIAMETER } from '../geometry/column';

export interface CutRow {
  name: string;
  kind: PartKind;
  columns: number[]; // 1-based
  qty: number;
  length: number;
  width: number;
  thickness: number;
  material: Material;
  notes: string[];
}

const KIND_ORDER: PartKind[] = ['side', 'top', 'bottom', 'back', 'shelf', 'door', 'drawerFront', 'fixedFront', 'plinth', 'rod'];
const r1 = (x: number) => Math.round(x * 10) / 10;

export function partDims(part: Part): { length: number; width: number } {
  if (part.kind === 'rod') return { length: r1(part.thickness), width: ROD_DIAMETER };
  const b = bounds2(part.outline);
  const a = b.max.x - b.min.x;
  const c = b.max.y - b.min.y;
  return { length: r1(Math.max(a, c)), width: r1(Math.min(a, c)) };
}

export function buildCutList(parts: Part[]): CutRow[] {
  const groups = new Map<string, CutRow>();
  for (const part of parts) {
    const { length, width } = partDims(part);
    const thickness = part.kind === 'rod' ? ROD_DIAMETER : r1(part.thickness);
    const notes = part.notes ?? [];
    const baseName = part.name.replace(/ \d+$/, '');
    const key = [part.kind, baseName, length, width, thickness, part.material, notes.join(';')].join('|');
    const col = part.columnIndex === null ? [] : [part.columnIndex + 1];
    const row = groups.get(key);
    if (row) {
      row.qty += 1;
      for (const c of col) if (!row.columns.includes(c)) row.columns.push(c);
    } else {
      groups.set(key, { name: baseName, kind: part.kind, columns: col, qty: 1, length, width, thickness, material: part.material, notes });
    }
  }
  return [...groups.values()]
    .map((r) => ({ ...r, columns: [...r.columns].sort((a, b) => a - b) }))
    .sort((a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      a.name.localeCompare(b.name) ||
      (a.columns[0] ?? 0) - (b.columns[0] ?? 0));
}
