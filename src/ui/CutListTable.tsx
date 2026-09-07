import { useMemo } from 'react';
import { useStore } from '../store/store';
import { buildParts } from '../geometry/parts';
import { buildCutList } from '../cutlist/cutlist';
import { type MessageKey } from '../i18n';
import { useT } from './useT';

export function CutListTable() {
  const project = useStore((s) => s.lastValid);
  const { t, tm } = useT();
  const rows = useMemo(() => buildCutList(buildParts(project)), [project]);
  const total = rows.reduce((s, r) => s + r.qty, 0);
  return (
    <table className="cutlist">
      <thead>
        <tr>
          <th>{t('table.num')}</th><th>{t('table.part')}</th><th>{t('table.col')}</th><th>{t('table.qty')}</th>
          <th>{t('table.length')}</th><th>{t('table.width')}</th><th>{t('table.thk')}</th><th>{t('table.material')}</th><th>{t('table.notes')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{i + 1}</td><td>{t(`part.${r.nameKey}` as MessageKey)}</td><td>{r.columns.join(', ')}</td><td>{r.qty}</td>
            <td>{r.length}</td><td>{r.width}</td><td>{r.thickness}</td><td>{t(`material.${r.material}` as MessageKey)}</td>
            <td>{r.notes.map((n) => tm(n)).join('; ')}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td colSpan={3}>{t('table.total')}</td><td>{total}</td><td colSpan={5} /></tr>
      </tfoot>
    </table>
  );
}
