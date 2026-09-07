import { create } from 'zustand';
import type { Cabinet, Column, Envelope, Project, ValidationError } from '../model/types';
import { defaultColumn, defaultProject } from '../model/defaults';
import { validate } from '../model/validate';
import { loadFromStorage, saveToStorage, type StorageLike } from './persist';

export type Tab = '3d' | 'front' | 'plan' | 'side' | 'cutlist';

export interface UiState {
  tab: Tab;
  showDims: boolean;
  explode: number; // 0..1
  showEnvelope: boolean;
  toast: string | null;
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
  toast: (msg: string | null) => void;
}

export function createPlannerStore(initial: Project = defaultProject()) {
  const initialErrors = validate(initial);
  return create<PlannerState>()((set, get) => ({
    project: initial,
    errors: initialErrors,
    lastValid: initialErrors.length ? defaultProject() : initial,
    ui: { tab: '3d', showDims: true, explode: 0, showEnvelope: true, toast: null },

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
        get().toast('No room for another column');
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
    toast: (msg) => set((s) => ({ ui: { ...s.ui, toast: msg } })),
  }));
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;

export function startAutosave(store: PlannerStore, storage: StorageLike, delay = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsub = store.subscribe((s, prev) => {
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
export const useStore = createPlannerStore((browserStorage && loadFromStorage(browserStorage)) ?? defaultProject());
if (browserStorage) startAutosave(useStore, browserStorage);
