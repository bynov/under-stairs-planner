import { describe, it, expect } from 'vitest';
import { buildPdf } from './exportPdf';
import { defaultProject } from '../model/defaults';
import { buildCutList } from '../cutlist/cutlist';
import { buildParts } from '../geometry/parts';

describe('buildPdf', () => {
  it('produces summary + 3 views + one page per column + cut list pages', () => {
    const p = defaultProject();
    const doc = buildPdf(p, { date: new Date('2026-09-07T00:00:00Z') });
    const rows = buildCutList(buildParts(p)).length;
    const cutPages = Math.max(1, Math.ceil(rows / 27));
    expect(doc.getNumberOfPages()).toBe(4 + 4 + cutPages);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(5000);
  });
  it('handles zero columns', () => {
    const p = defaultProject();
    p.cabinet.columns = [];
    expect(buildPdf(p).getNumberOfPages()).toBe(5);
  });
  it('does not throw on a bad snapshot', () => {
    expect(() => buildPdf(defaultProject(), { snapshotPng: 'data:image/png;base64,not-a-png' })).not.toThrow();
  });
  it('builds the Russian document with the embedded font and the same page count', () => {
    const p = defaultProject();
    const en = buildPdf(p, { lang: 'en' });
    const ru = buildPdf(p, { lang: 'ru' });
    expect(ru.getNumberOfPages()).toBe(en.getNumberOfPages());
    expect(Object.keys(ru.getFontList())).toContain('PTSans');
    expect(ru.getFont().fontName).toBe('PTSans');
    // the embedded TrueType font must actually be a Type0/CID font with an embedded glyph program,
    // otherwise Cyrillic text silently falls back to a font with no Cyrillic glyphs
    const raw = Buffer.from(ru.output('arraybuffer')).toString('latin1');
    expect(raw).toContain('FontFile2');
    expect(raw).toContain('/Type0');
  });
});
