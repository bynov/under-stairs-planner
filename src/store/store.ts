import { create } from 'zustand';
import type { Cabinet, Column, Envelope, Project, ValidationError } from '../model/types';
import { defaultColumn, defaultProject } from '../model/defaults';
import { validate } from '../model/validate';
import { detectLang, msg, readLangFromUrl, type Lang, type Msg } from '../i18n';
import { loadFromStorage, loadLang, saveLang, saveToStorage, type StorageLike } from './persist';

export type Tab = '3d' | 'front' | 'plan' | 'side' | 'cutlist';

export interface UiState {
  tab: Tab;
  showDims: boolean;
  explode: number; // 0..1
  showEnvelope: boolean;
  sidebarOpen: boolean; // mobile overlay panel
  toast: Msg | null;
  lang: Lang;
}

export interface PlannerState {
  project: Project;
  errors: ValidationError[];
  lastValid: Project;
  ui: UiState;
  setProject: (updater: (p: Project) => Project) => void;
  setName: (name: string) => void;
  setEnvelope: (patch: Partial<Envelope>) => void;
  setCabinet: (patch: Partial<Omit<Cabinet, 'columns'>>) => void;
  updateColumn: (id: string, patch: Partial<Omit<Column, 'id'>>) => void;
  addColumn: () => void;
  removeColumn: (id: string) => void;
  moveColumn: (id: string, dir: -1 | 1) => void;
  newProject: () => void;
  loadProject: (p: Project) => void;
  setUi: (patch: Partial<UiState>) => void;
  toast: (m: Msg | null) => void;
  setLang: (lang: Lang) => void;
}

export function createPlannerStore(initial: Project = defaultProject(), lang: Lang = 'en') {
  const initialErrors = validate(initial);
  return create<PlannerState>()((set, get) => ({
    project: initial,
    errors: initialErrors,
    lastValid: initialErrors.length ? defaultProject() : initial,
    ui: { tab: '3d', showDims: true, explode: 0, showEnvelope: true, sidebarOpen: false, toast: null, lang },

    setProject: (updater) =>
      set((s) => {
        const project = updater(s.project);
        const errors = validate(project);
        return { project, errors, lastValid: errors.length ? s.lastValid : project };
      }),
    setName: (name) => get().setProject((p) => ({ ...p, name })),
    setEnvelope: (patch) => get().setProject((p) => ({ ...p, envelope: { ...p.envelope, ...patch } })),
    setCabinet: (patch) => get().setProject((p) => ({ ...p, cabinet: { ...p.cabinet, ...patch } })),
    updateColumn: (id, patch) =>
      get().setProject((p) => ({
        ...p,
        cabinet: { ...p.cabinet, columns: p.cabinet.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
      })),
    addColumn: () => {
      const p = get().project;
      const used = p.cabinet.columns.reduce((s, c) => s + c.width, 0);
      const remaining = p.envelope.length - used;
      const minWidth = 2 * p.cabinet.panelThickness + 100;
      const width = remaining >= 500 ? 500 : remaining >= minWidth ? remaining : 0;
      if (width === 0) {
        get().toast(msg('toast.noRoom'));
        return;
      }
      get().setProject((q) => ({ ...q, cabinet: { ...q.cabinet, columns: [...q.cabinet.columns, defaultColumn(width)] } }));
    },
    removeColumn: (id) =>
      get().setProject((p) => ({ ...p, cabinet: { ...p.cabinet, columns: p.cabinet.columns.filter((c) => c.id !== id) } })),
    moveColumn: (id, dir) =>
      get().setProject((p) => {
        const cols = [...p.cabinet.columns];
        const i = cols.findIndex((c) => c.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= cols.length) return p;
        [cols[i], cols[j]] = [cols[j], cols[i]];
        return { ...p, cabinet: { ...p.cabinet, columns: cols } };
      }),
    newProject: () => get().loadProject(defaultProject()),
    loadProject: (project) => set({ project, errors: validate(project), lastValid: project }),
    setUi: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
    toast: (m) => set((s) => ({ ui: { ...s.ui, toast: m } })),
    setLang: (lang) => set((s) => ({ ui: { ...s.ui, lang } })),
  }));
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;

export function startAutosave(store: PlannerStore, storage: StorageLike, delay = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsub = store.subscribe((s, prev) => {
    if (s.ui.lang !== prev.ui.lang) saveLang(storage, s.ui.lang);
    if (s.project === prev.project) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveToStorage(storage, s.project), delay);
  });
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}

const browserStorage: StorageLike | null = typeof localStorage !== 'undefined' ? localStorage : null;

function initialLanguage(): Lang {
  const fromUrl = typeof location !== 'undefined' ? readLangFromUrl(location.search) : null;
  const hasLangParam = typeof location !== 'undefined' && new URLSearchParams(location.search).has('lang');
  const hasShot = typeof location !== 'undefined' && new URLSearchParams(location.search).has('shot');
  if (fromUrl && browserStorage) saveLang(browserStorage, fromUrl);
  if ((fromUrl || hasLangParam || hasShot) && typeof history !== 'undefined' && typeof location !== 'undefined') {
    const url = new URL(location.href);
    url.searchParams.delete('lang');
    url.searchParams.delete('shot');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return fromUrl ?? ((browserStorage && loadLang(browserStorage)) ?? detectLang(typeof navigator !== 'undefined' ? navigator.language : undefined));
}

const SHOT_TABS: readonly Tab[] = ['3d', 'front', 'plan', 'side', 'cutlist'];

function initialShot(): Tab | null {
  if (typeof location === 'undefined') return null;
  const raw = new URLSearchParams(location.search).get('shot');
  return raw && (SHOT_TABS as readonly string[]).includes(raw) ? (raw as Tab) : null;
}

const shotParam = initialShot();

export const useStore = createPlannerStore((browserStorage && loadFromStorage(browserStorage)) ?? defaultProject(), initialLanguage());

if (shotParam) {
  useStore.setState((s) => ({ ui: { ...s.ui, tab: shotParam } }));
}
if (browserStorage) startAutosave(useStore, browserStorage);
