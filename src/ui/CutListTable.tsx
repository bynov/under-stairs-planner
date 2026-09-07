import { useMemo } from 'react';
import { useStore } from '../store/store';
import { buildParts } from '../geometry/parts';
import { buildCutList } from '../cutlist/cutlist';

export function CutListTable() {
  const project = useStore((s) => s.lastValid);
  const rows = useMemo(() => buildCutList(buildParts(project)), [project]);
  const total = rows.reduce((s, r) => s + r.qty, 0);
  return (
    <table className="cutlist">
      <thead>
        <tr>
          <th>#</th><th>Part</th><th>Col</th><th>Qty</th><th>Length</th><th>Width</th><th>Thk</th><th>Material</th><th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{i + 1}</td><td>{r.name}</td><td>{r.columns.join(', ')}</td><td>{r.qty}</td>
            <td>{r.length}</td><td>{r.width}</td><td>{r.thickness}</td><td>{r.material}</td><td>{r.notes.join('; ')}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td colSpan={3}>Total parts</td><td>{total}</td><td colSpan={5} /></tr>
      </tfoot>
    </table>
  );
}
