import type { Project } from '../model/types';
import { validate } from '../model/validate';
import { isLang, msg, t, tm, type Lang, type Msg } from '../i18n';

export const STORAGE_KEY = 'understairs-planner:project';
export const FILE_VERSION = 1;

export function serializeProject(p: Project): string {
  return JSON.stringify({ version: FILE_VERSION, project: p }, null, 2);
}

export type ParseResult = { ok: true; project: Project } | { ok: false; error: Msg; reason?: Msg };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isProjectShape(v: unknown): v is Project {
  if (!isObj(v) || typeof v.name !== 'string' || !isObj(v.envelope) || !isObj(v.cabinet)) return false;
  const e = v.envelope, c = v.cabinet;
  if (!['length', 'heightMax', 'heightMin', 'depth', 'topClearance'].every((k) => isNum(e[k]))) return false;
  if (e.tallSide !== 'left' && e.tallSide !== 'right') return false;
  if (!['panelThickness', 'backThickness', 'plinthHeight', 'depth', 'gapBack'].every((k) => isNum(c[k]))) return false;
  if (c.topStyle !== 'sloped' && c.topStyle !== 'stepped') return false;
  if (!Array.isArray(c.columns)) return false;
  return c.columns.every(
    (col: unknown) =>
      isObj(col) && typeof col.id === 'string' && isNum(col.width) &&
      (col.front === 'none' || col.front === 'door' || col.front === 'drawers') &&
      isNum(col.shelves) && isNum(col.drawerCount) && typeof col.rod === 'boolean',
  );
}

/** Accepts anything shape-valid, without the `validate()` gate. Used for autosave restore, where
 * an invalid-but-shape-valid project must survive a reload (the store surfaces validation errors
 * and falls back to `lastValid` for views that need a valid project). */
export function parseProjectShape(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: msg('error.notJson') };
  }
  if (!isObj(data) || data.version !== FILE_VERSION) return { ok: false, error: msg('error.badVersion', { version: FILE_VERSION }) };
  if (!isProjectShape(data.project)) return { ok: false, error: msg('error.badShape') };
  return { ok: true, project: data.project };
}

/** Shape-valid AND passes `validate()`. Used for file import, where an invalid project should be rejected. */
export function parseProjectJson(text: string): ParseResult {
  const r = parseProjectShape(text);
  if (!r.ok) return r;
  const errors = validate(r.project);
  if (errors.length) return { ok: false, error: msg('error.failsValidation'), reason: errors[0].message };
  return r;
}

/** Renders a ParseResult's error (with its nested validation reason, if any) as text in `lang`. */
export function parseErrorText(lang: Lang, r: { error: Msg; reason?: Msg }): string {
  return r.reason ? t(lang, r.error.key, { reason: tm(lang, r.reason) }) : tm(lang, r.error);
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function loadFromStorage(storage: StorageLike): Project | null {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return null;
    const r = parseProjectShape(text);
    return r.ok ? r.project : null;
  } catch {
    return null;
  }
}

export function saveToStorage(storage: StorageLike, p: Project): void {
  try {
    storage.setItem(STORAGE_KEY, serializeProject(p));
  } catch {
    // quota exceeded or storage disabled: autosave is best-effort
  }
}

export const LANG_KEY = 'understairs-planner:lang';

export function loadLang(storage: StorageLike): Lang | null {
  try {
    const v = storage.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveLang(storage: StorageLike, lang: Lang): void {
  try {
    storage.setItem(LANG_KEY, lang);
  } catch {
    // best-effort
  }
}
