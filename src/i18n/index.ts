import { en, type MessageKey } from './en';
import { ru } from './ru';
import { de } from './de';
import { pl } from './pl';
import { es } from './es';

export type Lang = 'en' | 'ru' | 'de' | 'pl' | 'es';
export const LANGS: Lang[] = ['en', 'ru', 'de', 'pl', 'es'];
export type { MessageKey };
export type Params = Record<string, string | number>;
export interface Msg { key: MessageKey; params?: Params }

const dicts: Record<Lang, Record<MessageKey, string>> = { en, ru, de, pl, es };

export const msg = (key: MessageKey, params?: Params): Msg => (params ? { key, params } : { key });

export function t(lang: Lang, key: MessageKey, params?: Params): string {
  const s = dicts[lang][key] ?? dicts.en[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export const tm = (lang: Lang, m: Msg): string => t(lang, m.key, m.params);

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as string[]).includes(v);
}

export function detectLang(navLang: string | undefined): Lang {
  const p = navLang?.toLowerCase().slice(0, 2);
  return isLang(p) ? p : 'en';
}

/** `?lang=xx` from a location.search string, or null when absent/unsupported. */
export function readLangFromUrl(search: string): Lang | null {
  const v = new URLSearchParams(search).get('lang');
  return isLang(v) ? v : null;
}
