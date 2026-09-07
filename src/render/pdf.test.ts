import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { pickScale, drawingToPdf } from './pdf';
import { frontView } from '../drawing/views';
import { defaultProject } from '../model/defaults';

describe('pickScale', () => {
  it('rounds up to a standard scale', () => {
    const box = { x: 0, y: 0, w: 273, h: 170 };
    expect(pickScale(2600, 2200, box)).toBe(20);   // raw 12.94
    expect(pickScale(2600, 800, box)).toBe(10);    // raw 9.52
    expect(pickScale(100, 100, box)).toBe(1);
    expect(pickScale(100000, 100, box)).toBe(367); // beyond the table -> ceil(366.3)
  });
});

describe('drawingToPdf', () => {
  it('draws the front view onto a page and returns the scale', () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const N = drawingToPdf(doc, frontView(defaultProject()), { x: 12, y: 22, w: 273, h: 170 });
    expect(N).toBe(20);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(2000);
  });
});
