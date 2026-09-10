import type { Cabinet } from '../model/types';
import { PLINTH_SETBACK, REVEAL, ROD_DIAMETER, ROD_SETBACK, SHELF_SETBACK, type ColumnLayout } from '../geometry/column';
import { circle } from '../geometry/parts';
import { v2, type Vec2 } from '../geometry/vec';
import { line, poly, rectPrim, type Prim } from './ir';

/** Front elevation of one column in absolute XY, shifted by dx. */
export function columnFrontPrims(L: ColumnLayout, cab: Cabinet, dx = 0): Prim[] {
  const x0 = L.x0 + dx, x1 = L.x1 + dx;
  const t = cab.panelThickness, pl = cab.plinthHeight;
  const sh = (q: Vec2) => v2(q.x + x0, q.y + pl);
  const out: Prim[] = [];
  out.push(poly([v2(x0, pl), v2(x1, pl), v2(x1, L.hLow), v2(x0, L.hTall)], 'thick'));
  out.push(rectPrim(x0, pl, t, L.sideLeftH));
  out.push(rectPrim(x1 - t, pl, t, L.sideRightH));
  out.push(rectPrim(x0, 0, L.width, pl));
  const hidden = !!L.doorOutline;                 // contents behind a door -> hidden lines
  const stroke = hidden ? 'dashed' : 'thin';
  const fill = hidden ? 'none' : 'panel';
  if (L.doorOutline) out.push(poly(L.doorOutline.map(sh), 'thin', 'panel'));
  for (const d of L.drawerFronts) out.push(rectPrim(x0 + d.x0, pl + d.y0, d.x1 - d.x0, d.y1 - d.y0, stroke, fill));
  for (const y of L.shelfYs) out.push(rectPrim(x0 + t, y - t, L.interiorWidth, t, stroke));
  if (L.topShelfY !== null) out.push(rectPrim(x0 + t, L.topShelfY - t, L.interiorWidth, t, stroke));
  if (L.rodY !== null) out.push(line(v2(x0 + t, L.rodY), v2(x1 - t, L.rodY), 'dashed'));
  return out;
}

/** Section through one column: drawing-x = model Z (front at dx), drawing-y = model Y. */
export function columnSectionPrims(L: ColumnLayout, cab: Cabinet, dx = 0, side: 'left' | 'right' = 'right'): Prim[] {
  const t = cab.panelThickness, pl = cab.plinthHeight, D = cab.depth, bt = cab.backThickness;
  const h = side === 'right' ? L.hLow : L.hTall;
  const sideH = side === 'right' ? L.sideRightH : L.sideLeftH;
  const backH = side === 'right' ? L.backRightH : L.backLeftH;
  const topUnder = h - L.topThick;
  const rodY = L.rodY;
  const out: Prim[] = [];
  out.push(rectPrim(dx, pl, D, sideH, 'thick'));
  out.push(rectPrim(dx, pl, D, t));
  out.push(rectPrim(dx, topUnder, D, L.topThick));
  out.push(rectPrim(dx + D - bt, pl + t, bt, backH));
  for (const y of L.shelfYs) out.push(rectPrim(dx + SHELF_SETBACK, y - t, L.interiorDepth - SHELF_SETBACK, t));
  if (L.topShelfY !== null) out.push(rectPrim(dx + SHELF_SETBACK, L.topShelfY - t, L.interiorDepth - SHELF_SETBACK, t));
  if (rodY !== null) out.push(poly(circle(ROD_DIAMETER / 2, 24).map((q) => v2(q.x + dx + ROD_SETBACK, q.y + rodY))));
  out.push(rectPrim(dx + PLINTH_SETBACK, 0, t, pl));
  if (L.doorOutline) out.push(rectPrim(dx - t, pl + REVEAL, t, h - pl - 2 * REVEAL, 'thin', 'panel'));
  const fz = L.drawerStyle === 'internal' ? dx : dx - t;
  for (const d of L.drawerFronts) out.push(rectPrim(fz, pl + d.y0, t, d.y1 - d.y0, 'thin', 'panel'));
  return out;
}
