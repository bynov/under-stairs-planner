import { useStore } from '../store/store';
import { NumberField, Section, SelectField } from './fields';
import { ColumnCard } from './ColumnCard';

export function Sidebar() {
  const project = useStore((s) => s.project);
  const errors = useStore((s) => s.errors);
  const setEnvelope = useStore((s) => s.setEnvelope);
  const setCabinet = useStore((s) => s.setCabinet);
  const addColumn = useStore((s) => s.addColumn);
  const { envelope: env, cabinet: cab } = project;
  return (
    <aside className="sidebar">
      {errors.length > 0 && (
        <div className="errors">
          {errors.map((e, i) => <div key={i}>{e.message}</div>)}
        </div>
      )}
      <Section title="Envelope">
        <NumberField label="Length" value={env.length} min={1} onChange={(v) => setEnvelope({ length: v })} />
        <NumberField label="Height max" value={env.heightMax} min={1} onChange={(v) => setEnvelope({ heightMax: v })} />
        <NumberField label="Height min" value={env.heightMin} min={0} onChange={(v) => setEnvelope({ heightMin: v })} />
        <NumberField label="Depth" value={env.depth} min={1} onChange={(v) => setEnvelope({ depth: v })} />
        <NumberField label="Top clearance" value={env.topClearance} min={0} onChange={(v) => setEnvelope({ topClearance: v })} />
        <SelectField
          label="Tall side"
          value={env.tallSide}
          options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
          onChange={(v) => setEnvelope({ tallSide: v })}
        />
      </Section>
      <Section title="Cabinet">
        <NumberField label="Depth" value={cab.depth} min={200} onChange={(v) => setCabinet({ depth: v })} />
        <NumberField label="Min gap to back wall" value={cab.gapBack} min={0} onChange={(v) => setCabinet({ gapBack: v })} />
        <NumberField label="Panel thickness" value={cab.panelThickness} min={1} onChange={(v) => setCabinet({ panelThickness: v })} />
        <NumberField label="Back thickness" value={cab.backThickness} min={1} onChange={(v) => setCabinet({ backThickness: v })} />
        <NumberField label="Plinth height" value={cab.plinthHeight} min={0} onChange={(v) => setCabinet({ plinthHeight: v })} />
        <SelectField
          label="Top style"
          value={cab.topStyle}
          options={[{ value: 'sloped', label: 'Sloped' }, { value: 'stepped', label: 'Stepped' }]}
          onChange={(v) => setCabinet({ topStyle: v })}
        />
      </Section>
      <Section title="Columns">
        {cab.columns.map((c, i) => <ColumnCard key={c.id} column={c} index={i} count={cab.columns.length} />)}
        <button onClick={addColumn}>Add column</button>
      </Section>
    </aside>
  );
}
