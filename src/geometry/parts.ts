import type { Project } from '../model/types';
import { slopeAngle } from './envelope';
import { layoutColumns, PLINTH_SETBACK, REVEAL, ROD_DIAMETER, ROD_SETBACK, SHELF_SETBACK } from './column';
import { bounds3, FLAT_ROT, NO_ROT, ROD_ROT, SIDE_ROT, toWorld, v2, v3, type Box3, type Transform, type Vec2, type Vec3 } from './vec';

export type PartKind =
  | 'side' | 'top' | 'bottom' | 'back' | 'shelf' | 'door' | 'drawerFront' | 'fixedFront' | 'plinth' | 'rod';
export type Material = 'panel' | 'back' | 'rod';

export interface Part {
  id: string;
  columnIndex: number | null;
  name: string;
  kind: PartKind;
  outline: Vec2[];      // local XY polygon, mm
  thickness: number;    // extrusion along local +Z
  transform: Transform;
  material: Material;
  notes?: string[];
}

export function rect(w: number, h: number): Vec2[] {
  return [v2(0, 0), v2(w, 0), v2(w, h), v2(0, h)];
}

export function circle(r: number, n: number): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return v2(r * Math.cos(a), r * Math.sin(a));
  });
}

export const deg = (rad: number) => Math.round((rad * 180) / Math.PI * 10) / 10;
const r1 = (x: number) => Math.round(x * 10) / 10;

export function partBounds(part: Part): Box3 {
  const pts: Vec3[] = [];
  for (const o of part.outline) {
    pts.push(toWorld(part.transform, v3(o.x, o.y, 0)));
    pts.push(toWorld(part.transform, v3(o.x, o.y, part.thickness)));
  }
  return bounds3(pts);
}

export function buildParts(p: Project): Part[] {
  const cab = p.cabinet;
  const t = cab.panelThickness;
  const plinth = cab.plinthHeight;
  const theta = slopeAngle(p.envelope);
  const sloped = cab.topStyle === 'sloped';
  const bevel = `bevel ${deg(theta)} deg`;
  const parts: Part[] = [];

  for (const L of layoutColumns(p)) {
    const i = L.index;
    const x0 = L.x0;
    const w = L.width;
    const add = (
      key: string, name: string, kind: PartKind, outline: Vec2[], thickness: number,
      position: Vec3, rotation: Vec3, material: Material = 'panel', notes?: string[],
    ) => parts.push({ id: `col${i}-${key}`, columnIndex: i, name, kind, outline, thickness, transform: { position, rotation }, material, notes });

    const trap = (hL: number, hR: number) => (sloped ? [`trapezoid L ${r1(hL)} / R ${r1(hR)}`] : undefined);

    add('sideL', 'Side L', 'side', rect(cab.depth, L.sideLeftH), t, v3(x0 + t, plinth, 0), SIDE_ROT, 'panel', sloped ? [`top edge ${bevel}`] : undefined);
    add('sideR', 'Side R', 'side', rect(cab.depth, L.sideRightH), t, v3(x0 + w, plinth, 0), SIDE_ROT, 'panel', sloped ? [`top edge ${bevel}`] : undefined);
    add('bottom', 'Bottom', 'bottom', rect(L.interiorWidth, cab.depth), t, v3(x0 + t, plinth + t, 0), FLAT_ROT);
    if (sloped) {
      add('top', 'Top', 'top', rect(w / Math.cos(theta), cab.depth), t, v3(x0, L.hTall, 0), v3(Math.PI / 2, 0, -theta), 'panel', [`end edges ${bevel}`]);
    } else {
      add('top', 'Top', 'top', rect(w, cab.depth), t, v3(x0, L.hLow, 0), FLAT_ROT);
    }
    add('back', 'Back', 'back',
      [v2(0, 0), v2(L.interiorWidth, 0), v2(L.interiorWidth, L.backRightH), v2(0, L.backLeftH)],
      cab.backThickness, v3(x0 + t, plinth + t, cab.depth - cab.backThickness), NO_ROT, 'back', trap(L.backLeftH, L.backRightH));
    L.shelfYs.forEach((y, k) => {
      add(`shelf${k + 1}`, `Shelf ${k + 1}`, 'shelf', rect(L.interiorWidth, L.interiorDepth - SHELF_SETBACK), t, v3(x0 + t, y, SHELF_SETBACK), FLAT_ROT);
    });
    if (L.doorOutline) {
      add('door', 'Door', 'door', L.doorOutline, t, v3(x0, plinth, -t), NO_ROT, 'panel', trap(L.doorOutline[3].y - L.doorOutline[0].y, L.doorOutline[2].y - L.doorOutline[1].y));
    }
    L.drawerFronts.forEach((d, k) => {
      add(`drawer${k + 1}`, `Drawer front ${k + 1}`, 'drawerFront', rect(w - 2 * REVEAL, d.y1 - d.y0), t, v3(x0 + REVEAL, plinth + d.y0, -t), NO_ROT);
    });
    if (L.fixedFront) {
      const f = L.fixedFront;
      add('fixedFront', 'Fixed front', 'fixedFront', f, t, v3(x0, plinth, -t), NO_ROT, 'panel', [`trapezoid L ${r1(f[3].y - f[0].y)} / R ${r1(f[2].y - f[1].y)}`]);
    }
    if (L.rodY !== null) {
      add('rod', 'Rod', 'rod', circle(ROD_DIAMETER / 2, 24), L.interiorWidth, v3(x0 + t, L.rodY, ROD_SETBACK), ROD_ROT, 'rod', [`dia ${ROD_DIAMETER} mm`]);
    }
    add('plinth', 'Plinth', 'plinth', rect(w, plinth), t, v3(x0, 0, PLINTH_SETBACK), NO_ROT);
  }
  return parts;
}
