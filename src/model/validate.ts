import type { Project, ValidationError } from './types';
import { ceilY, slopeAngle } from '../geometry/envelope';
import { msg, type MessageKey, type Params } from '../i18n';

export function validate(p: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const err = (path: string, key: MessageKey, params?: Params) => errors.push({ path, message: msg(key, params) });
  const { envelope: env, cabinet: cab } = p;

  if (!(env.length > 0)) err('envelope.length', 'error.length');
  if (!(env.heightMax > 0)) err('envelope.heightMax', 'error.heightMax');
  if (!(env.depth > 0)) err('envelope.depth', 'error.depth');
  if (!(env.heightMin >= 0 && env.heightMin < env.heightMax)) err('envelope.heightMin', 'error.heightMin');
  if (!(env.topClearance >= 0)) err('envelope.topClearance', 'error.topClearance');

  if (!(cab.panelThickness > 0)) err('cabinet.panelThickness', 'error.panelThickness');
  if (!(cab.backThickness > 0)) err('cabinet.backThickness', 'error.backThickness');
  if (!(cab.plinthHeight >= 0)) err('cabinet.plinthHeight', 'error.plinthHeight');
  if (!(cab.gapBack >= 0)) err('cabinet.gapBack', 'error.gapBack');
  if (!(cab.depth >= 200)) err('cabinet.depth', 'error.cabinetDepthMin');
  if (cab.depth + cab.gapBack > env.depth) {
    err('cabinet.depth', 'error.cabinetDepthFit', { total: cab.depth + cab.gapBack, depth: env.depth });
  }

  const total = cab.columns.reduce((s, c) => s + c.width, 0);
  if (total > env.length) err('cabinet.columns', 'error.columnsTotal', { total, length: env.length });

  const envelopeOk = env.length > 0 && env.heightMin >= 0 && env.heightMax > env.heightMin;
  const t = cab.panelThickness;
  const minWidth = 2 * t + 100;
  const minHeight = cab.plinthHeight + 2 * t + 100;
  let x = 0;
  cab.columns.forEach((c, i) => {
    const path = `cabinet.columns[${i}]`;
    const n = i + 1;
    if (!(c.width >= minWidth)) err(`${path}.width`, 'error.columnWidth', { n, min: minWidth });
    const x0 = x;
    x += c.width;
    if (envelopeOk) {
      const hLow = ceilY(env, x) - env.topClearance;
      if (hLow < minHeight) err(`${path}.width`, 'error.columnHeight', { n, h: Math.round(hLow), min: minHeight });
      if (c.interior === 'drawers' && c.drawerCount >= 1) {
        // mirrors layoutColumn's zone math (src/geometry/column.ts); keep in sync
        const G = 3, R = 2;
        const theta = slopeAngle(env);
        const sloped = cab.topStyle === 'sloped';
        const hTall = ceilY(env, x0) - env.topClearance;
        const topY = (lx: number) => (sloped ? hTall - lx * Math.tan(theta) : hLow);
        const topUnderY = (lx: number) => topY(lx) - (sloped ? t / Math.cos(theta) : t);
        const floorY = cab.plinthHeight + t;
        const interiorHeight = topUnderY(c.width - t) - floorY;
        const zone = c.door
          ? interiorHeight - 2 * G
          : (sloped ? floorY + interiorHeight - cab.plinthHeight - t - R : hLow - cab.plinthHeight - R) - R;
        const drawerH = (zone - (c.drawerCount - 1) * G) / c.drawerCount;
        if (drawerH < 30) {
          err(`${path}.drawerCount`, 'error.drawerHeight', { n, h: Math.round(drawerH), min: 30 });
        }
      }
    }
    if (c.interior === 'drawers' && !(c.drawerCount >= 1)) err(`${path}.drawerCount`, 'error.drawerCount', { n });
    if (!(c.shelves >= 0)) err(`${path}.shelves`, 'error.shelves', { n });
  });
  return errors;
}
