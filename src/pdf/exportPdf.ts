import { jsPDF } from 'jspdf';
import type { Project } from '../model/types';
import { buildParts, deg } from '../geometry/parts';
import { slopeAngle } from '../geometry/envelope';
import { layoutColumns } from '../geometry/column';
import { buildCutList, type CutRow } from '../cutlist/cutlist';
import { columnDetail, frontView, planView, sideView } from '../drawing/views';
import type { Drawing } from '../drawing/ir';
import { drawingToPdf, type PdfBox } from '../render/pdf';
import { t, tm, type Lang, type MessageKey } from '../i18n';
import { registerPdfFont } from './font';

export interface PdfOptions { lang?: Lang; snapshotPng?: string | null; date?: Date }

const W = 297, H = 210, M = 12;
const BOX: PdfBox = { x: M, y: M + 10, w: W - 2 * M, h: H - 2 * M - 16 };
const ROW_H = 6;
export const ROWS_PER_PAGE = 27;

export function buildPdf(p: Project, opts: PdfOptions = {}): jsPDF {
  const lang = opts.lang ?? 'en';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registerPdfFont(doc);
  summaryPage(doc, p, opts, lang);
  for (const d of [frontView(p, lang), planView(p, lang), sideView(p, lang)]) {
    doc.addPage();
    drawingPage(doc, d, lang);
  }
  layoutColumns(p).forEach((_, i) => {
    doc.addPage();
    drawingPage(doc, columnDetail(p, i, lang), lang);
  });
  cutListPages(doc, buildCutList(buildParts(p)), lang);
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

function drawingPage(doc: jsPDF, d: Drawing, lang: Lang): void {
  header(doc, d.title);
  const N = drawingToPdf(doc, d, BOX);
  doc.setFontSize(9);
  doc.text(t(lang, 'pdf.scale', { n: N }), W - M, H - M / 2, { align: 'right' });
}

function summaryPage(doc: jsPDF, p: Project, opts: PdfOptions, lang: Lang): void {
  header(doc, p.name || t(lang, 'pdf.defaultTitle'));
  const date = (opts.date ?? new Date()).toISOString().slice(0, 10);
  const env = p.envelope, cab = p.cabinet;
  const columns = cab.columns
    .map((c, i) => [
      `${i + 1}: ${c.width} ${t(lang, `ui.interior.${c.interior}` as MessageKey)}`,
      c.interior === 'drawers' ? t(lang, 'pdf.drawersCount', { n: c.drawerCount }) : '',
      c.interior === 'shelves' && c.shelves ? t(lang, 'pdf.shelvesCount', { n: c.shelves }) : '',
      c.door ? t(lang, 'pdf.withDoor') : '',
      c.rod && c.interior === 'shelves' ? t(lang, 'pdf.withRod') : '',
    ].filter(Boolean).join(' '))
    .join('; ');
  const rows: [string, string][] = [
    [t(lang, 'pdf.date'), date],
    [t(lang, 'pdf.envelopeLength'), `${env.length}`],
    [t(lang, 'pdf.heightMaxMin'), `${env.heightMax} / ${env.heightMin}`],
    [t(lang, 'pdf.envelopeDepth'), `${env.depth}`],
    [t(lang, 'pdf.slope'), t(lang, 'pdf.slopeValue', { deg: deg(slopeAngle(env)) })],
    [t(lang, 'pdf.tallSide'), t(lang, `ui.side.${env.tallSide}` as MessageKey)],
    [t(lang, 'pdf.topClearance'), `${env.topClearance}`],
    [t(lang, 'pdf.cabinetDepthGap'), `${cab.depth} / ${cab.gapBack}`],
    [t(lang, 'pdf.thickness'), `${cab.panelThickness} / ${cab.backThickness}`],
    [t(lang, 'pdf.plinthHeight'), `${cab.plinthHeight}`],
    [t(lang, 'pdf.topStyle'), t(lang, `ui.top.${cab.topStyle}` as MessageKey)],
    [t(lang, 'pdf.columns'), columns || t(lang, 'pdf.none')],
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
      doc.text(t(lang, 'pdf.snapshotFailed'), imgX, imgY + 6);
    }
  } else {
    doc.text(t(lang, 'pdf.snapshotMissing'), imgX, imgY + 6);
  }
}

function cutListPages(doc: jsPDF, rows: CutRow[], lang: Lang): void {
  const cols: [string, number][] = [
    [t(lang, 'table.num'), M], [t(lang, 'table.part'), M + 10], [t(lang, 'table.col'), M + 58], [t(lang, 'table.qty'), M + 74], [t(lang, 'table.length'), M + 88],
    [t(lang, 'table.width'), M + 108], [t(lang, 'table.thk'), M + 128], [t(lang, 'table.material'), M + 142], [t(lang, 'table.notes'), M + 166],
  ];
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  for (let page = 0; page < pages; page++) {
    doc.addPage();
    header(doc, page === 0 ? t(lang, 'pdf.cutList') : t(lang, 'pdf.cutListCont', { n: page + 1 }));
    doc.setFontSize(9);
    let y = M + 14;
    for (const [name, x] of cols) doc.text(name, x, y);
    y += ROW_H;
    const start = page * ROWS_PER_PAGE;
    rows.slice(start, start + ROWS_PER_PAGE).forEach((r, j) => {
      const vals = [
        String(start + j + 1), t(lang, `part.${r.nameKey}` as MessageKey), r.columns.join(','), String(r.qty), String(r.length),
        String(r.width), String(r.thickness), t(lang, `material.${r.material}` as MessageKey), r.notes.map((n) => tm(lang, n)).join('; ').slice(0, 55),
      ];
      vals.forEach((v, k) => doc.text(v, cols[k][1], y));
      y += ROW_H;
    });
  }
  const total = rows.reduce((s, r) => s + r.qty, 0);
  doc.setFontSize(9);
  doc.text(t(lang, 'pdf.total', { n: total }), W - M, H - M / 2, { align: 'right' });
}
