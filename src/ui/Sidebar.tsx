import { useStore } from '../store/store';
import { NumberField, Section, SelectField } from './fields';
import { ColumnCard } from './ColumnCard';
import { useT } from './useT';

export function Sidebar() {
  const project = useStore((s) => s.project);
  const errors = useStore((s) => s.errors);
  const setEnvelope = useStore((s) => s.setEnvelope);
  const setCabinet = useStore((s) => s.setCabinet);
  const addColumn = useStore((s) => s.addColumn);
  const { t, tm } = useT();
  const { envelope: env, cabinet: cab } = project;
  return (
    <aside className="sidebar">
      {errors.length > 0 && (
        <div className="errors">
          {errors.map((e, i) => <div key={i}>{tm(e.message)}</div>)}
        </div>
      )}
      <Section title={t('ui.section.envelope')}>
        <NumberField label={t('ui.length')} value={env.length} min={1} onChange={(v) => setEnvelope({ length: v })} />
        <NumberField label={t('ui.heightMax')} value={env.heightMax} min={1} onChange={(v) => setEnvelope({ heightMax: v })} />
        <NumberField label={t('ui.heightMin')} value={env.heightMin} min={0} onChange={(v) => setEnvelope({ heightMin: v })} />
        <NumberField label={t('ui.depth')} value={env.depth} min={1} onChange={(v) => setEnvelope({ depth: v })} />
        <NumberField label={t('ui.topClearance')} value={env.topClearance} min={0} onChange={(v) => setEnvelope({ topClearance: v })} />
        <SelectField
          label={t('ui.tallSide')}
          value={env.tallSide}
          options={[{ value: 'left', label: t('ui.side.left') }, { value: 'right', label: t('ui.side.right') }]}
          onChange={(v) => setEnvelope({ tallSide: v })}
        />
      </Section>
      <Section title={t('ui.section.cabinet')}>
        <NumberField label={t('ui.depth')} value={cab.depth} min={200} onChange={(v) => setCabinet({ depth: v })} />
        <NumberField label={t('ui.gapBack')} value={cab.gapBack} min={0} onChange={(v) => setCabinet({ gapBack: v })} />
        <NumberField label={t('ui.panelThickness')} value={cab.panelThickness} min={1} onChange={(v) => setCabinet({ panelThickness: v })} />
        <NumberField label={t('ui.backThickness')} value={cab.backThickness} min={1} onChange={(v) => setCabinet({ backThickness: v })} />
        <NumberField label={t('ui.plinthHeight')} value={cab.plinthHeight} min={0} onChange={(v) => setCabinet({ plinthHeight: v })} />
        <SelectField
          label={t('ui.topStyle')}
          value={cab.topStyle}
          options={[{ value: 'sloped', label: t('ui.top.sloped') }, { value: 'stepped', label: t('ui.top.stepped') }]}
          onChange={(v) => setCabinet({ topStyle: v })}
        />
      </Section>
      <Section title={t('ui.section.columns')}>
        {cab.columns.map((c, i) => <ColumnCard key={c.id} column={c} index={i} count={cab.columns.length} />)}
        <button onClick={addColumn}>{t('ui.addColumn')}</button>
      </Section>
    </aside>
  );
}
