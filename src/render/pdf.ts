import type { jsPDF } from 'jspdf';
import { expandPrims, type Drawing, type Stroke } from '../drawing/ir';
import type { Vec2 } from '../geometry/vec';

export const STANDARD_SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200];
export interface PdfBox { x: number; y: number; w: number; h: number }

export function pickScale(drawW: number, drawH: number, box: PdfBox): number {
  const raw = Math.max(drawW / box.w, drawH / box.h);
  return STANDARD_SCALES.find((n) => n >= raw) ?? Math.ceil(raw);
}

const PT_PER_MM = 72 / 25.4;

function applyStroke(doc: jsPDF, s: Stroke | undefined): void {
  doc.setLineWidth(s === 'thick' ? 0.5 : 0.2);
  doc.setLineDashPattern(s === 'dashed' ? [2, 1] : [], 0);
}

function polygon(doc: jsPDF, pts: Vec2[], style: string, closed: boolean): void {
  if (pts.length < 2) return;
  const segs = pts.slice(1).map((q, i) => [q.x - pts[i].x, q.y - pts[i].y]);
  doc.lines(segs, pts[0].x, pts[0].y, [1, 1], style, closed);
}

/** Draws `d` centred in `box` at the chosen standard scale. Returns N of 1:N. */
export function drawingToPdf(doc: jsPDF, d: Drawing, box: PdfBox): number {
  const b = d.bounds;
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  const N = pickScale(w, h, box);
  const ox = box.x + (box.w - w / N) / 2 - b.min.x / N;
  const oy = box.y + (box.h - h / N) / 2 + b.max.y / N;
  const X = (x: number) => ox + x / N;
  const Y = (y: number) => oy - y / N;
  doc.setDrawColor(20, 20, 20);
  doc.setTextColor(20, 20, 20);
  doc.setFillColor(232, 226, 213);
  for (const p of expandPrims(d.prims, d.textSize)) {
    if (p.t === 'line') {
      applyStroke(doc, p.stroke);
      doc.line(X(p.a.x), Y(p.a.y), X(p.b.x), Y(p.b.y));
    } else if (p.t === 'poly') {
      applyStroke(doc, p.stroke);
      polygon(doc, p.pts.map((q) => ({ x: X(q.x), y: Y(q.y) })), p.fill === 'panel' ? 'FD' : 'S', p.closed);
    } else if (p.t === 'text') {
      doc.setFontSize(((p.size ?? d.textSize) / N) * PT_PER_MM);
      doc.text(p.text, X(p.at.x), Y(p.at.y), {
        angle: p.rotate ?? 0,
        align: p.anchor === 'end' ? 'right' : p.anchor === 'middle' ? 'center' : 'left',
        baseline: 'middle',
      });
    }
  }
  doc.setLineDashPattern([], 0);
  return N;
}
