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
});
