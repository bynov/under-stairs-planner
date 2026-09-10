import type { Project } from '../model/types';
import { columnRanges, slopeAngle, type ColumnRange } from './envelope';
import { v2, type Vec2 } from './vec';

export const REVEAL = 2;
export const DRAWER_GAP = 3;
export const SHELF_SETBACK = 20;
export const ROD_DROP = 200;
export const ROD_SETBACK = 250;
export const ROD_DIAMETER = 25;
export const PLINTH_SETBACK = 40;

export interface DrawerFront { x0: number; x1: number; y0: number; y1: number } // column-local (origin at x0, plinth top)
export type DrawerStyle = 'overlay' | 'internal';

export interface ColumnLayout extends ColumnRange {
  topThick: number;       // vertical thickness of the top panel (t / cos theta when sloped)
  sideLeftH: number;      // side panel heights, from plinth top to underside of the top panel
  sideRightH: number;
  interiorWidth: number;
  interiorDepth: number;
  interiorHeight: number; // at the low side (inside the right side panel)
  floorY: number;         // absolute Y of the bottom panel top surface
  backLeftH: number;      // back panel heights at its left/right edges
  backRightH: number;
  shelfPitch: number;
  shelfYs: number[];      // absolute Y of each shelf top surface
  doorOutline: Vec2[] | null;      // column-local
  drawerFronts: DrawerFront[];     // column-local
  drawerStyle: DrawerStyle | null;
  topShelfY: number | null;   // absolute top surface of the open shelf in the triangle above overlay drawers or a rod (sloped top only)
  rodY: number | null;             // absolute Y of rod axis
}

export function layoutColumn(p: Project, r: ColumnRange): ColumnLayout {
  const cab = p.cabinet;
  const col = r.column;
  const t = cab.panelThickness;
  const plinth = cab.plinthHeight;
  const w = r.width;
  const theta = slopeAngle(p.envelope);
  const sloped = cab.topStyle === 'sloped';
  const tan = Math.tan(theta);
  const topThick = sloped ? t / Math.cos(theta) : t;

  /** outer top surface height at column-local x */
  const topY = (lx: number) => (sloped ? r.hTall - lx * tan : r.hLow);
  const topUnderY = (lx: number) => topY(lx) - topThick;

  const sideLeftH = topUnderY(0) - plinth;
  // side R occupies [x1 - t, x1]; take the long point of the bevel at the inner face x1 - t,
  // matching the top panel's underside there (t·tanθ higher than at the outer edge x1).
  const sideRightH = topUnderY(w - t) - plinth;
  const interiorWidth = w - 2 * t;
  const interiorDepth = cab.depth - cab.backThickness;
  const floorY = plinth + t;
  const backLeftH = topUnderY(t) - floorY;
  const backRightH = topUnderY(w - t) - floorY;
  const interiorHeight = backRightH;

  const shelfCount = col.interior === 'shelves' ? col.shelves : 0;
  const shelfPitch = interiorHeight / (shelfCount + 1);
  const shelfYs = Array.from({ length: shelfCount }, (_, k) => floorY + (k + 1) * shelfPitch);

  /** front outline height at column-local x, relative to plinth top */
  const frontTop = (lx: number) => topY(lx) - plinth;
  const R = REVEAL, G = DRAWER_GAP;

  const doorOutline: Vec2[] | null = col.door
    ? [v2(R, R), v2(w - R, R), v2(w - R, frontTop(w - R) - R), v2(R, frontTop(R) - R)]
    : null;

  let drawerFronts: DrawerFront[] = [];
  let drawerStyle: DrawerStyle | null = null;
  let topShelfY: number | null = null;
  if (col.interior === 'drawers') {
    const n = col.drawerCount;
    drawerStyle = col.door ? 'internal' : 'overlay';
    if (!col.door && sloped) topShelfY = floorY + interiorHeight; // open shelf in the triangle above the drawers
    const x0 = col.door ? t + G : R;
    const x1 = col.door ? w - t - G : w - R;
    const zoneBot = col.door ? t + G : R;
    const zoneTop = col.door
      ? t + interiorHeight - G
      : topShelfY !== null ? topShelfY - plinth - t - R : r.hLow - plinth - R;
    const h = (zoneTop - zoneBot - (n - 1) * G) / n;
    drawerFronts = Array.from({ length: n }, (_, i) => {
      const y0 = zoneBot + i * (h + G);
      return { x0, x1, y0, y1: y0 + h };
    });
  }

  const rodY = col.rod && col.interior === 'shelves' ? r.hLow - ROD_DROP : null;
  if (rodY !== null && sloped) topShelfY = floorY + interiorHeight; // open shelf in the triangle above the rod

  return {
    ...r,
    topThick, sideLeftH, sideRightH, interiorWidth, interiorDepth, interiorHeight, floorY,
    backLeftH, backRightH, shelfPitch, shelfYs, doorOutline, drawerFronts, drawerStyle, topShelfY, rodY,
  };
}

export function layoutColumns(p: Project): ColumnLayout[] {
  return columnRanges(p).map((r) => layoutColumn(p, r));
}
