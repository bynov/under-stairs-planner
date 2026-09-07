import type { Column } from '../model/types';
import { useStore } from '../store/store';
import { columnRanges } from '../geometry/envelope';
import { CheckField, NumberField, SelectField } from './fields';
import { useT } from './useT';

export function ColumnCard({ column, index, count }: { column: Column; index: number; count: number }) {
  const project = useStore((s) => s.project);
  const updateColumn = useStore((s) => s.updateColumn);
  const removeColumn = useStore((s) => s.removeColumn);
  const moveColumn = useStore((s) => s.moveColumn);
  const { t } = useT();
  const range = columnRanges(project)[index];
  const fmt = (n: number) => (Number.isFinite(n) ? String(Math.round(n)) : '-');
  const set = (patch: Partial<Omit<Column, 'id'>>) => updateColumn(column.id, patch);
  return (
    <div className="card">
      <strong>{t('ui.column', { n: index + 1 })}</strong>
      <NumberField label={t('ui.width')} value={column.width} min={1} onChange={(v) => set({ width: v })} />
      <SelectField
        label={t('ui.front')}
        value={column.front}
        options={[{ value: 'none', label: t('ui.front.none') }, { value: 'door', label: t('ui.front.door') }, { value: 'drawers', label: t('ui.front.drawers') }]}
        onChange={(v) => set({ front: v })}
      />
      {column.front === 'drawers' ? (
        <NumberField label={t('ui.drawerCount')} value={column.drawerCount} min={1} onChange={(v) => set({ drawerCount: Math.round(v) })} />
      ) : (
        <CheckField label={t('ui.rod')} value={column.rod} onChange={(v) => set({ rod: v })} />
      )}
      <NumberField label={t('ui.shelves')} value={column.shelves} min={0} onChange={(v) => set({ shelves: Math.round(v) })} />
      <div className="derived">{t('ui.derived', { tall: fmt(range.hTall), low: fmt(range.hLow) })}</div>
      <div className="row">
        <button disabled={index === 0} onClick={() => moveColumn(column.id, -1)}>{t('ui.moveLeft')}</button>
        <button disabled={index === count - 1} onClick={() => moveColumn(column.id, 1)}>{t('ui.moveRight')}</button>
        <button onClick={() => removeColumn(column.id)}>{t('ui.remove')}</button>
      </div>
    </div>
  );
}
