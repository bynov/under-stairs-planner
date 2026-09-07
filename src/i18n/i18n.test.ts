import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';
import { t, tm, msg, detectLang, isLang, LANGS } from './index';

describe('dictionaries', () => {
  it('have identical key sets and no empty strings', () => {
    const ek = Object.keys(en).sort();
    const rk = Object.keys(ru).sort();
    expect(rk).toEqual(ek);
    for (const k of ek) {
      expect((en as Record<string, string>)[k].length).toBeGreaterThan(0);
      expect((ru as Record<string, string>)[k].length).toBeGreaterThan(0);
    }
  });
  it('russian strings contain Cyrillic where expected', () => {
    expect(ru['part.sideL']).toMatch(/[А-Яа-я]/);
    expect(ru['view.front']).toBe('Фасад');
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
  it('maps ru locales to ru, everything else to en', () => {
    expect(detectLang('ru')).toBe('ru');
    expect(detectLang('ru-RU')).toBe('ru');
    expect(detectLang('en-GB')).toBe('en');
    expect(detectLang(undefined)).toBe('en');
    expect(isLang('ru')).toBe(true);
    expect(isLang('de')).toBe(false);
    expect(LANGS).toEqual(['en', 'ru']);
  });
});
