import { useRef, useState } from 'react';
import { useStore, type Tab } from '../store/store';
import { parseErrorText, parseProjectJson, serializeProject } from '../store/persist';
import { exportPdfBlob } from '../pdf/exportPdf';
import { downloadBlob } from './download';
import { takeSnapshot } from './snapshot';
import { useT } from './useT';
import { LANGS, type Lang, type MessageKey } from '../i18n';

const TABS: { key: Tab; labelKey: MessageKey }[] = [
  { key: '3d', labelKey: 'ui.tab.3d' },
  { key: 'front', labelKey: 'ui.tab.front' },
  { key: 'plan', labelKey: 'ui.tab.plan' },
  { key: 'side', labelKey: 'ui.tab.side' },
  { key: 'cutlist', labelKey: 'ui.tab.cutlist' },
];

export function TopBar() {
  const project = useStore((s) => s.project);
  const lastValid = useStore((s) => s.lastValid);
  const tab = useStore((s) => s.ui.tab);
  const sidebarOpen = useStore((s) => s.ui.sidebarOpen);
  const { lang, t } = useT();
  const { setName, setUi, newProject, loadProject, toast, setLang } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const safeName = (project.name || 'cabinet').replace(/[^\w.-]+/g, '_');

  const onNew = () => {
    if (window.confirm(t('ui.confirmNew'))) newProject();
  };
  const onExportJson = () => {
    downloadBlob(new Blob([serializeProject(project)], { type: 'application/json' }), `${safeName}.json`);
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const r = parseProjectJson(await file.text());
    if (r.ok) {
      loadProject(r.project);
      toast({ key: 'toast.imported' });
    } else {
      toast({ key: 'toast.importFailed', params: { error: parseErrorText(lang, r) } });
    }
  };
  const onExportPdf = async () => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 0)); // let the button repaint
      const blob = exportPdfBlob(lastValid, { lang, snapshotPng: takeSnapshot() });
      downloadBlob(blob, `${safeName}.pdf`);
    } catch (e) {
      toast({ key: 'toast.pdfFailed', params: { error: e instanceof Error ? e.message : String(e) } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <a className="brand" href={lang === 'en' ? '/' : `/${lang}/`} title={t('ui.appTitle')}>⌂</a>
      <button className="mobile-only" onClick={() => setUi({ sidebarOpen: !sidebarOpen })}>{t('ui.edit')}</button>
      <input className="name" value={project.name} onChange={(e) => setName(e.target.value)} placeholder={t('ui.projectName')} />
      <nav className="tabs">
        {TABS.map((tb) => (
          <button key={tb.key} className={tb.key === tab ? 'active' : ''} onClick={() => setUi({ tab: tb.key, sidebarOpen: false })}>
            {t(tb.labelKey)}
          </button>
        ))}
      </nav>
      <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
        {LANGS.map((l) => (
          <option key={l} value={l}>{t(`ui.lang.${l}` as MessageKey)}</option>
        ))}
      </select>
      <span className="spacer" />
      <button onClick={onNew}>{t('ui.new')}</button>
      <button onClick={() => fileRef.current?.click()}>{t('ui.importJson')}</button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void onImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button onClick={onExportJson}>{t('ui.exportJson')}</button>
      <button onClick={onExportPdf} disabled={busy}>{busy ? t('ui.exporting') : t('ui.exportPdf')}</button>
    </header>
  );
}
