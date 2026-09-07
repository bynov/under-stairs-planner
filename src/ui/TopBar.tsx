import { useRef, useState } from 'react';
import { useStore, type Tab } from '../store/store';
import { parseProjectJson, serializeProject } from '../store/persist';
import { exportPdfBlob } from '../pdf/exportPdf';
import { downloadBlob } from './download';
import { takeSnapshot } from './snapshot';

const TABS: { key: Tab; label: string }[] = [
  { key: '3d', label: '3D' },
  { key: 'front', label: 'Front' },
  { key: 'plan', label: 'Plan' },
  { key: 'side', label: 'Side' },
  { key: 'cutlist', label: 'Cut list' },
];

export function TopBar() {
  const project = useStore((s) => s.project);
  const lastValid = useStore((s) => s.lastValid);
  const tab = useStore((s) => s.ui.tab);
  const { setName, setUi, newProject, loadProject, toast } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const safeName = (project.name || 'cabinet').replace(/[^\w.-]+/g, '_');

  const onNew = () => {
    if (window.confirm('Replace the current project with the defaults?')) newProject();
  };
  const onExportJson = () => {
    downloadBlob(new Blob([serializeProject(project)], { type: 'application/json' }), `${safeName}.json`);
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const r = parseProjectJson(await file.text());
    if (r.ok) {
      loadProject(r.project);
      toast('Project imported');
    } else {
      toast(`Import failed: ${r.error}`);
    }
  };
  const onExportPdf = async () => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 0)); // let the button repaint
      const blob = exportPdfBlob(lastValid, { snapshotPng: takeSnapshot() });
      downloadBlob(blob, `${safeName}.pdf`);
    } catch (e) {
      toast(`PDF export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <input className="name" value={project.name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === tab ? 'active' : ''} onClick={() => setUi({ tab: t.key })}>
            {t.label}
          </button>
        ))}
      </nav>
      <span className="spacer" />
      <button onClick={onNew}>New</button>
      <button onClick={() => fileRef.current?.click()}>Import JSON</button>
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
      <button onClick={onExportJson}>Export JSON</button>
      <button onClick={onExportPdf} disabled={busy}>{busy ? 'Exporting...' : 'Export PDF'}</button>
    </header>
  );
}
