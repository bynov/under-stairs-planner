import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { en } from '../i18n/en';
import { ru } from '../i18n/ru';
import { de } from '../i18n/de';
import { pl } from '../i18n/pl';
import { es } from '../i18n/es';

/** Code points mapped by the font's cmap (format 4 and 12 subtables). */
function cmapCodepoints(ttf: Buffer): Set<number> {
  const dv = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const numTables = dv.getUint16(4);
  let cmapOff = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(ttf[rec], ttf[rec + 1], ttf[rec + 2], ttf[rec + 3]);
    if (tag === 'cmap') cmapOff = dv.getUint32(rec + 8);
  }
  if (cmapOff < 0) throw new Error('no cmap table');
  const out = new Set<number>();
  const n = dv.getUint16(cmapOff + 2);
  for (let i = 0; i < n; i++) {
    const sub = cmapOff + dv.getUint32(cmapOff + 4 + i * 8 + 4);
    const format = dv.getUint16(sub);
    if (format === 4) {
      const segX2 = dv.getUint16(sub + 6);
      const ends = sub + 14, starts = ends + segX2 + 2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = dv.getUint16(ends + s * 2), start = dv.getUint16(starts + s * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end; c++) out.add(c);
      }
    } else if (format === 12) {
      const groups = dv.getUint32(sub + 12);
      for (let g = 0; g < groups; g++) {
        const p = sub + 16 + g * 12;
        const start = dv.getUint32(p), end = dv.getUint32(p + 4);
        for (let c = start; c <= end; c++) out.add(c);
      }
    }
  }
  return out;
}

describe('PDF font covers every dictionary', () => {
  const ttf = readFileSync(fileURLToPath(new URL('./fonts/PT_Sans-Web-Regular.ttf', import.meta.url)));
  const cps = cmapCodepoints(ttf);
  it('has a populated cmap', () => {
    expect(cps.has('A'.codePointAt(0)!)).toBe(true);
    expect(cps.has('Я'.codePointAt(0)!)).toBe(true);
  });
  for (const [name, dict] of Object.entries({ en, ru, de, pl, es })) {
    it(`${name}: no missing glyphs`, () => {
      const missing = new Set<string>();
      for (const s of Object.values(dict)) {
        for (const ch of s) {
          const cp = ch.codePointAt(0)!;
          if (cp >= 0x20 && !cps.has(cp)) missing.add(ch);
        }
      }
      expect([...missing], `characters missing from PT Sans in ${name}`).toEqual([]);
    });
  }
});
