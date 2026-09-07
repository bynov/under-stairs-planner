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

export interface DrawerFront { y0: number; y1: number } // column-local (origin at plinth top)

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
  fixedFront: Vec2[] | null;       // column-local
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

  const shelfPitch = interiorHeight / (col.shelves + 1);
  const shelfYs = Array.from({ length: col.shelves }, (_, k) => floorY + (k + 1) * shelfPitch);

  /** front outline height at column-local x, relative to plinth top */
  const frontTop = (lx: number) => topY(lx) - plinth;
  const R = REVEAL;

  let doorOutline: Vec2[] | null = null;
  let drawerFronts: DrawerFront[] = [];
  let fixedFront: Vec2[] | null = null;

  if (col.front === 'door') {
    doorOutline = [v2(R, R), v2(w - R, R), v2(w - R, frontTop(w - R) - R), v2(R, frontTop(R) - R)];
  } else if (col.front === 'drawers') {
    const n = col.drawerCount;
    const zoneBot = R;
    const zoneTop = r.hLow - plinth - R;
    const h = (zoneTop - zoneBot - (n - 1) * DRAWER_GAP) / n;
    drawerFronts = Array.from({ length: n }, (_, i) => {
      const y0 = zoneBot + i * (h + DRAWER_GAP);
      return { y0, y1: y0 + h };
    });
    if (sloped) {
      const y0 = r.hLow - plinth + R;
      const yR = Math.max(y0, frontTop(w - R) - R);
      const yL = frontTop(R) - R;
      fixedFront = [v2(R, y0), v2(w - R, y0), v2(w - R, yR), v2(R, yL)];
    }
  }

  const rodY = col.rod && col.front !== 'drawers' ? r.hLow - ROD_DROP : null;

  return {
    ...r,
    topThick, sideLeftH, sideRightH, interiorWidth, interiorDepth, interiorHeight, floorY,
    backLeftH, backRightH, shelfPitch, shelfYs, doorOutline, drawerFronts, fixedFront, rodY,
  };
}

export function layoutColumns(p: Project): ColumnLayout[] {
  return columnRanges(p).map((r) => layoutColumn(p, r));
}
