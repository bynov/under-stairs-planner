import { describe, it, expect, vi } from 'vitest';
import { createPlannerStore, startAutosave } from './store';
import { serializeProject, parseProjectJson, loadFromStorage, loadLang } from './persist';
import { defaultProject } from '../model/defaults';

const memStorage = () => {
  const mem = new Map<string, string>();
  return { mem, getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
};

describe('store', () => {
  it('keeps lastValid when an edit makes the project invalid', () => {
    const s = createPlannerStore();
    const before = s.getState().project;
    s.getState().setEnvelope({ heightMin: 5000 });
    expect(s.getState().errors.length).toBeGreaterThan(0);
    expect(s.getState().lastValid).toBe(before);
    s.getState().setEnvelope({ heightMin: 900 });
    expect(s.getState().errors).toEqual([]);
    expect(s.getState().lastValid).toBe(s.getState().project);
  });
  it('addColumn appends 500 when it fits, else the remainder, else toasts', () => {
    const s = createPlannerStore();
    s.getState().addColumn(); // 2500 of 2600 used: remainder 100 < min 136
    expect(s.getState().project.cabinet.columns).toHaveLength(4);
    expect(s.getState().ui.toast).toEqual({ key: 'toast.noRoom' });
    s.getState().setEnvelope({ length: 3000 });
    s.getState().addColumn();
    expect(s.getState().project.cabinet.columns[4].width).toBe(500);
    s.getState().setEnvelope({ length: 3200 });
    s.getState().addColumn();
    expect(s.getState().project.cabinet.columns[5].width).toBe(200);
  });
  it('updateColumn, moveColumn, removeColumn', () => {
    const s = createPlannerStore();
    const [a, b] = s.getState().project.cabinet.columns;
    s.getState().updateColumn(b.id, { shelves: 5 });
    expect(s.getState().project.cabinet.columns[1].shelves).toBe(5);
    s.getState().moveColumn(b.id, -1);
    expect(s.getState().project.cabinet.columns[0].id).toBe(b.id);
    s.getState().moveColumn(b.id, -1); // no-op at the start
    expect(s.getState().project.cabinet.columns[0].id).toBe(b.id);
    s.getState().removeColumn(a.id);
    expect(s.getState().project.cabinet.columns.find((c) => c.id === a.id)).toBeUndefined();
  });
  it('newProject and loadProject replace the project', () => {
    const s = createPlannerStore();
    s.getState().setName('X');
    s.getState().newProject();
    expect(s.getState().project.name).toBe(defaultProject().name);
    const p = defaultProject();
    p.name = 'Loaded';
    s.getState().loadProject(p);
    expect(s.getState().lastValid.name).toBe('Loaded');
  });
  it('autosaves debounced', () => {
    vi.useFakeTimers();
    const storage = memStorage();
    const s = createPlannerStore();
    const stop = startAutosave(s, storage, 100);
    s.getState().setName('A');
    s.getState().setName('B');
    expect(storage.mem.size).toBe(0);
    vi.advanceTimersByTime(150);
    expect(loadFromStorage(storage)?.name).toBe('B');
    stop();
    vi.useRealTimers();
  });
});

describe('persist', () => {
  it('round-trips JSON', () => {
    const p = defaultProject();
    const r = parseProjectJson(serializeProject(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });
  it('rejects garbage, wrong version, bad shape, invalid project', () => {
    expect(parseProjectJson('nope').ok).toBe(false);
    expect(parseProjectJson('{"version":2,"project":{}}').ok).toBe(false);
    expect(parseProjectJson('{"version":1,"project":{"name":"x"}}').ok).toBe(false);
    const p = defaultProject();
    p.cabinet.depth = 5000;
    const r = parseProjectJson(serializeProject(p));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.key).toBe('error.failsValidation');
  });
  it('persists the language immediately and restores it', () => {
    const storage = memStorage();
    const s = createPlannerStore(defaultProject(), 'en');
    const stop = startAutosave(s, storage, 100);
    expect(s.getState().ui.lang).toBe('en');
    s.getState().setLang('ru');
    expect(loadLang(storage)).toBe('ru');
    stop();
    storage.setItem('understairs-planner:lang', 'xx');
    expect(loadLang(storage)).toBeNull();
  });
  it('loadFromStorage returns null for empty or corrupt storage', () => {
    const storage = memStorage();
    expect(loadFromStorage(storage)).toBeNull();
    storage.setItem('understairs-planner:project', '{broken');
    expect(loadFromStorage(storage)).toBeNull();
  });
  it('restoring an autosaved invalid project keeps the edit instead of resetting (F1)', () => {
    vi.useFakeTimers();
    const storage = memStorage();
    const s = createPlannerStore();
    const stop = startAutosave(s, storage, 100);
    s.getState().setEnvelope({ heightMin: 5000 }); // invalid, but shape-valid
    vi.advanceTimersByTime(150);
    stop();
    vi.useRealTimers();

    const restored = loadFromStorage(storage);
    expect(restored).not.toBeNull();
    const s2 = createPlannerStore(restored!);
    expect(s2.getState().project.envelope.heightMin).toBe(5000);
    expect(s2.getState().errors.length).toBeGreaterThan(0);
    // structurally the default project (ids are non-deterministic per defaultProject() call, so compare with ids stripped)
    const stripIds = (p: ReturnType<typeof defaultProject>) => ({
      ...p,
      cabinet: { ...p.cabinet, columns: p.cabinet.columns.map(({ id: _id, ...rest }) => rest) },
    });
    expect(stripIds(s2.getState().lastValid)).toEqual(stripIds(defaultProject()));

    // parseProjectJson (used for file import) still rejects the invalid project
    expect(parseProjectJson(storage.mem.get('understairs-planner:project')!).ok).toBe(false);
  });
});
