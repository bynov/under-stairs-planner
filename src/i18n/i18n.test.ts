import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';
import { de } from './de';
import { pl } from './pl';
import { es } from './es';
import { t, tm, msg, detectLang, isLang, readLangFromUrl, LANGS, type Lang } from './index';

const dicts: Record<Lang, Record<string, string>> = { en, ru, de, pl, es };

describe('dictionaries', () => {
  it('LANGS lists every dictionary in display order', () => {
    expect(LANGS).toEqual(['en', 'ru', 'de', 'pl', 'es']);
  });
  it('have identical key sets, no empty strings and matching placeholders', () => {
    const ek = Object.keys(en).sort();
    for (const lang of LANGS) {
      const d = dicts[lang];
      expect(Object.keys(d).sort(), lang).toEqual(ek);
      for (const k of ek) {
        expect(d[k].length, `${lang}:${k}`).toBeGreaterThan(0);
        const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
        expect(ph(d[k]), `${lang}:${k} placeholders`).toEqual(ph((en as Record<string, string>)[k]));
      }
    }
  });
  it('non-English dictionaries are actually translated', () => {
    expect(ru['part.sideL']).toMatch(/[А-Яа-я]/);
    expect(ru['view.front']).toBe('Фасад');
    expect(de['ui.tab.cutlist']).not.toBe(en['ui.tab.cutlist']);
    expect(pl['ui.tab.cutlist']).not.toBe(en['ui.tab.cutlist']);
    expect(es['ui.tab.cutlist']).not.toBe(en['ui.tab.cutlist']);
  });
  it('language names are native', () => {
    expect(en['ui.lang.en']).toBe('English');
    expect(en['ui.lang.ru']).toBe('Русский');
    expect(en['ui.lang.de']).toBe('Deutsch');
    expect(en['ui.lang.pl']).toBe('Polski');
    expect(en['ui.lang.es']).toBe('Español');
    for (const lang of LANGS) for (const l of LANGS) expect(dicts[lang][`ui.lang.${l}`]).toBe(en[`ui.lang.${l}` as keyof typeof en]);
  });
});

describe('t', () => {
  it('translates and interpolates', () => {
    expect(t('en', 'ui.column', { n: 2 })).toBe('Column 2');
    expect(t('ru', 'ui.column', { n: 2 })).toBe('Секция 2');
    expect(t('en', 'label.slope', { deg: 26.6 })).toBe('slope 26.6°');
  });
  it('leaves unknown placeholders and translates Msg objects', () => {
    expect(t('en', 'ui.column')).toBe('Column {n}');
    expect(tm('ru', msg('note.rodDia', { d: 25 }))).toBe('Ø25 мм');
  });
});

describe('detectLang / isLang', () => {
  it('maps locale prefixes to supported languages, everything else to en', () => {
    expect(detectLang('ru')).toBe('ru');
    expect(detectLang('ru-RU')).toBe('ru');
    expect(detectLang('de-AT')).toBe('de');
    expect(detectLang('pl')).toBe('pl');
    expect(detectLang('es-MX')).toBe('es');
    expect(detectLang('en-GB')).toBe('en');
    expect(detectLang('fr')).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });
  it('isLang accepts only supported codes', () => {
    for (const l of LANGS) expect(isLang(l)).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});

describe('readLangFromUrl', () => {
  it('returns a supported lang from ?lang=', () => {
    expect(readLangFromUrl('?lang=de')).toBe('de');
    expect(readLangFromUrl('?foo=1&lang=pl')).toBe('pl');
  });
  it('returns null for missing or unsupported values', () => {
    expect(readLangFromUrl('')).toBeNull();
    expect(readLangFromUrl('?lang=fr')).toBeNull();
    expect(readLangFromUrl('?lang=')).toBeNull();
  });
});
