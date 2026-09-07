import { jsPDF } from 'jspdf';
import type { Project } from '../model/types';
import { buildParts, deg } from '../geometry/parts';
import { slopeAngle } from '../geometry/envelope';
import { layoutColumns } from '../geometry/column';
import { buildCutList, type CutRow } from '../cutlist/cutlist';
import { columnDetail, frontView, planView, sideView } from '../drawing/views';
import type { Drawing } from '../drawing/ir';
import { drawingToPdf, type PdfBox } from '../render/pdf';

export interface PdfOptions { snapshotPng?: string | null; date?: Date }

const W = 297, H = 210, M = 12;
const BOX: PdfBox = { x: M, y: M + 10, w: W - 2 * M, h: H - 2 * M - 16 };
const ROW_H = 6;
export const ROWS_PER_PAGE = 27;

export function buildPdf(p: Project, opts: PdfOptions = {}): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  summaryPage(doc, p, opts);
  for (const d of [frontView(p), planView(p), sideView(p)]) {
    doc.addPage();
    drawingPage(doc, d);
  }
  layoutColumns(p).forEach((_, i) => {
    doc.addPage();
    drawingPage(doc, columnDetail(p, i));
  });
  cutListPages(doc, buildCutList(buildParts(p)));
  return doc;
}

export function exportPdfBlob(p: Project, opts: PdfOptions = {}): Blob {
  return buildPdf(p, opts).output('blob');
}

function header(doc: jsPDF, title: string): void {
  doc.setFontSize(14);
  doc.text(title, M, M + 4);
  doc.setLineWidth(0.3);
  doc.line(M, M + 7, W - M, M + 7);
}

function drawingPage(doc: jsPDF, d: Drawing): void {
  header(doc, d.title);
  const N = drawingToPdf(doc, d, BOX);
  doc.setFontSize(9);
  doc.text(`Scale 1:${N} (mm)`, W - M, H - M / 2, { align: 'right' });
}

function summaryPage(doc: jsPDF, p: Project, opts: PdfOptions): void {
  header(doc, p.name || 'Under-stairs cabinet');
  const date = (opts.date ?? new Date()).toISOString().slice(0, 10);
  const env = p.envelope, cab = p.cabinet;
  const columns = cab.columns
    .map((c, i) => `${i + 1}: ${c.width} ${c.front}${c.front === 'drawers' ? ` x${c.drawerCount}` : ''}${c.shelves ? ` +${c.shelves} shelves` : ''}${c.rod && c.front !== 'drawers' ? ' rod' : ''}`)
    .join('; ');
  const rows: [string, string][] = [
    ['Date', date],
    ['Envelope length', `${env.length}`],
    ['Height max / min', `${env.heightMax} / ${env.heightMin}`],
    ['Envelope depth', `${env.depth}`],
    ['Slope', `${deg(slopeAngle(env))} deg`],
    ['Tall side', env.tallSide],
    ['Top clearance', `${env.topClearance}`],
    ['Cabinet depth / min gap', `${cab.depth} / ${cab.gapBack}`],
    ['Panel / back thickness', `${cab.panelThickness} / ${cab.backThickness}`],
    ['Plinth height', `${cab.plinthHeight}`],
    ['Top style', cab.topStyle],
    ['Columns', columns || 'none'],
  ];
  doc.setFontSize(10);
  let y = M + 16;
  for (const [k, v] of rows) {
    doc.text(k, M, y);
    const lines = doc.splitTextToSize(v, 100) as string[];
    doc.text(lines, M + 50, y);
    y += ROW_H * Math.max(1, lines.length);
  }
  const imgX = W - M - 120, imgY = M + 14;
  if (opts.snapshotPng) {
    try {
      doc.addImage(opts.snapshotPng, 'PNG', imgX, imgY, 120, 80);
    } catch {
      doc.text('(3D snapshot unavailable)', imgX, imgY + 6);
    }
  } else {
    doc.text('(open the 3D tab before exporting to include a snapshot)', imgX, imgY + 6);
  }
}

function cutListPages(doc: jsPDF, rows: CutRow[]): void {
  const cols: [string, number][] = [
    ['#', M], ['Part', M + 10], ['Col', M + 58], ['Qty', M + 74], ['Length', M + 88],
    ['Width', M + 108], ['Thk', M + 128], ['Material', M + 142], ['Notes', M + 166],
  ];
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  for (let page = 0; page < pages; page++) {
    doc.addPage();
    header(doc, page === 0 ? 'Cut list' : `Cut list (cont. ${page + 1})`);
    doc.setFontSize(9);
    let y = M + 14;
    for (const [name, x] of cols) doc.text(name, x, y);
    y += ROW_H;
    const start = page * ROWS_PER_PAGE;
    rows.slice(start, start + ROWS_PER_PAGE).forEach((r, j) => {
      const vals = [
        String(start + j + 1), r.name, r.columns.join(','), String(r.qty), String(r.length),
        String(r.width), String(r.thickness), r.material, r.notes.join('; ').slice(0, 55),
      ];
      vals.forEach((v, k) => doc.text(v, cols[k][1], y));
      y += ROW_H;
    });
  }
  const total = rows.reduce((s, r) => s + r.qty, 0);
  doc.setFontSize(9);
  doc.text(`Total parts: ${total}`, W - M, H - M / 2, { align: 'right' });
}
