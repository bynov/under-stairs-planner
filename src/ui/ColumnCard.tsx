import type { Column } from '../model/types';
import { useStore } from '../store/store';
import { columnRanges } from '../geometry/envelope';
import { CheckField, NumberField, SelectField } from './fields';

export function ColumnCard({ column, index, count }: { column: Column; index: number; count: number }) {
  const project = useStore((s) => s.project);
  const updateColumn = useStore((s) => s.updateColumn);
  const removeColumn = useStore((s) => s.removeColumn);
  const moveColumn = useStore((s) => s.moveColumn);
  const range = columnRanges(project)[index];
  const fmt = (n: number) => (Number.isFinite(n) ? String(Math.round(n)) : '-');
  const set = (patch: Partial<Omit<Column, 'id'>>) => updateColumn(column.id, patch);
  return (
    <div className="card">
      <strong>Column {index + 1}</strong>
      <NumberField label="Width" value={column.width} min={1} onChange={(v) => set({ width: v })} />
      <SelectField
        label="Front"
        value={column.front}
        options={[{ value: 'none', label: 'Open' }, { value: 'door', label: 'Door' }, { value: 'drawers', label: 'Drawers' }]}
        onChange={(v) => set({ front: v })}
      />
      {column.front === 'drawers' ? (
        <NumberField label="Drawers" value={column.drawerCount} min={1} onChange={(v) => set({ drawerCount: Math.round(v) })} />
      ) : (
        <CheckField label="Hanging rod" value={column.rod} onChange={(v) => set({ rod: v })} />
      )}
      <NumberField label="Shelves" value={column.shelves} min={0} onChange={(v) => set({ shelves: Math.round(v) })} />
      <div className="derived">top: tall {fmt(range.hTall)} / low {fmt(range.hLow)} mm</div>
      <div className="row">
        <button disabled={index === 0} onClick={() => moveColumn(column.id, -1)}>Left</button>
        <button disabled={index === count - 1} onClick={() => moveColumn(column.id, 1)}>Right</button>
        <button onClick={() => removeColumn(column.id)}>Remove</button>
      </div>
    </div>
  );
}
