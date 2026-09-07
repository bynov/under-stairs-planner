import type { Project } from '../model/types';
import { slopeAngle } from '../geometry/envelope';
import { layoutColumns, PLINTH_SETBACK, REVEAL } from '../geometry/column';
import { deg } from '../geometry/parts';
import { v2 } from '../geometry/vec';
import { dim, line, makeDrawing, mirrorX, poly, rectPrim, text, textSizeFor, type Drawing, type Prim } from './ir';
import { fmtLen } from './dim';
import { columnFrontPrims, columnSectionPrims } from './column';

function finish(p: Project, title: string, prims: Prim[], s: number, mirror: boolean): Drawing {
  const d = makeDrawing(title, prims, s);
  return mirror && p.envelope.tallSide === 'right' ? mirrorX(d) : d;
}

export function frontView(p: Project): Drawing {
  const env = p.envelope, cab = p.cabinet;
  const s = textSizeFor(env.length, env.heightMax);
  const cols = layoutColumns(p);
  const total = cols.length ? cols[cols.length - 1].x1 : 0;
  const prims: Prim[] = [];
  prims.push(poly([v2(0, 0), v2(env.length, 0), v2(env.length, env.heightMin), v2(0, env.heightMax)], 'dashed'));
  for (const L of cols) prims.push(...columnFrontPrims(L, cab));
  if (cols.length) {
    prims.push(dim(v2(0, 0), v2(total, 0), -3 * s));
    for (const L of cols) prims.push(dim(v2(L.x0, 0), v2(L.x1, 0), -1.5 * s));
    prims.push(dim(v2(0, 0), v2(0, cols[0].hTall), 2 * s));
    cols.forEach((L, i) => prims.push(dim(v2(L.x1, 0), v2(L.x1, L.hLow), i === cols.length - 1 ? -2 * s : -0.8 * s)));
    prims.push(dim(v2(0, 0), v2(0, cab.plinthHeight), 5 * s, `plinth ${fmtLen(cab.plinthHeight)}`));
  }
  prims.push(dim(v2(0, 0), v2(env.length, 0), -5.5 * s));
  prims.push(text(v2(env.length / 2, env.heightMax + 1.5 * s), `slope ${deg(slopeAngle(env))} deg`, s, 'middle'));
  return finish(p, 'Front elevation', prims, s, true);
}

export function planView(p: Project): Drawing {
  const env = p.envelope, cab = p.cabinet;
  const t = cab.panelThickness, bt = cab.backThickness;
  const s = textSizeFor(env.length, env.depth);
  const cols = layoutColumns(p);
  const total = cols.length ? cols[cols.length - 1].x1 : 0;
  const prims: Prim[] = [rectPrim(0, 0, env.length, env.depth, 'dashed')];
  for (const L of cols) {
    prims.push(rectPrim(L.x0, 0, L.width, cab.depth, 'thick'));
    prims.push(rectPrim(L.x0, 0, t, cab.depth));
    prims.push(rectPrim(L.x1 - t, 0, t, cab.depth));
    prims.push(rectPrim(L.x0 + t, cab.depth - bt, L.interiorWidth, bt));
    prims.push(line(v2(L.x0, PLINTH_SETBACK), v2(L.x1, PLINTH_SETBACK), 'dashed'));
    if (L.doorOutline || L.drawerFronts.length) prims.push(rectPrim(L.x0 + REVEAL, -t, L.width - 2 * REVEAL, t, 'thin', 'panel'));
  }
  if (cols.length) {
    prims.push(dim(v2(0, 0), v2(total, 0), -3 * s));
    for (const L of cols) prims.push(dim(v2(L.x0, 0), v2(L.x1, 0), -1.5 * s));
    prims.push(dim(v2(total, 0), v2(total, cab.depth), -2 * s));
    prims.push(dim(v2(total, cab.depth), v2(total, env.depth), -2 * s, `clear ${fmtLen(env.depth - cab.depth)}`));
  }
  prims.push(dim(v2(env.length, 0), v2(env.length, env.depth), -5 * s));
  prims.push(dim(v2(0, env.depth), v2(env.length, env.depth), 2 * s));
  return finish(p, 'Plan', prims, s, true);
}

export function sideView(p: Project): Drawing {
  const env = p.envelope, cab = p.cabinet;
  const s = textSizeFor(env.depth, env.heightMax);
  const cols = layoutColumns(p);
  const prims: Prim[] = [rectPrim(0, 0, env.depth, env.heightMax, 'dashed')];
  if (cols.length) {
    const L = cols[0];
    prims.push(...columnSectionPrims(L, cab, 0, 'left'));
    prims.push(dim(v2(0, 0), v2(0, L.hTall), 3 * s));
    prims.push(dim(v2(0, 0), v2(cab.depth, 0), -1.5 * s));
    prims.push(dim(v2(cab.depth, 0), v2(env.depth, 0), -1.5 * s, `clear ${fmtLen(env.depth - cab.depth)}`));
  }
  prims.push(dim(v2(0, 0), v2(0, env.heightMax), 6 * s));
  prims.push(dim(v2(0, 0), v2(env.depth, 0), -3.5 * s));
  prims.push(dim(v2(env.depth, 0), v2(env.depth, cab.plinthHeight), -2 * s, `plinth ${fmtLen(cab.plinthHeight)}`));
  return finish(p, 'Side section (tall end)', prims, s, false);
}

export function columnDetail(p: Project, index: number): Drawing {
  const cab = p.cabinet, t = cab.panelThickness, pl = cab.plinthHeight;
  const L = layoutColumns(p)[index];
  const s = textSizeFor(L.width + cab.depth, L.hTall);
  const dx = -L.x0;               // front drawn with the column at x = 0
  const sx = L.width + 6 * s;     // section origin
  const prims: Prim[] = [...columnFrontPrims(L, cab, dx), ...columnSectionPrims(L, cab, sx, 'right')];
  const zr = sx + cab.depth;      // section right edge
  // front dims
  prims.push(dim(v2(0, 0), v2(L.width, 0), -1.5 * s));
  prims.push(dim(v2(0, 0), v2(0, L.hTall), 2 * s));
  prims.push(dim(v2(t, L.floorY), v2(L.width - t, L.floorY), 1.5 * s, `inner ${fmtLen(L.interiorWidth)}`));
  for (const d of L.drawerFronts) prims.push(dim(v2(L.width, pl + d.y0), v2(L.width, pl + d.y1), -1.5 * s));
  // section dims
  prims.push(dim(v2(sx, 0), v2(sx, L.hLow), 2 * s));
  prims.push(dim(v2(zr, L.floorY), v2(zr, L.floorY + L.interiorHeight), -1.5 * s, `inner ${fmtLen(L.interiorHeight)}`));
  if (L.shelfYs.length) prims.push(dim(v2(zr, L.floorY), v2(zr, L.shelfYs[0]), -3.5 * s, `pitch ${fmtLen(L.shelfPitch)}`));
  if (L.rodY !== null) prims.push(dim(v2(zr, 0), v2(zr, L.rodY), -3.5 * s, `rod ${fmtLen(L.rodY)}`));
  prims.push(dim(v2(sx, 0), v2(zr, 0), -1.5 * s));
  prims.push(text(v2(0, L.hTall + 1.5 * s), 'Front', s, 'start'));
  prims.push(text(v2(sx, L.hTall + 1.5 * s), 'Section (low side)', s, 'start'));
  return makeDrawing(`Column ${index + 1} detail`, prims, s);
}
