import type { Project, ValidationError } from './types';
import { ceilY } from '../geometry/envelope';

export function validate(p: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });
  const { envelope: env, cabinet: cab } = p;

  if (!(env.length > 0)) err('envelope.length', 'Length must be > 0');
  if (!(env.heightMax > 0)) err('envelope.heightMax', 'Max height must be > 0');
  if (!(env.depth > 0)) err('envelope.depth', 'Depth must be > 0');
  if (!(env.heightMin >= 0 && env.heightMin < env.heightMax)) {
    err('envelope.heightMin', 'Min height must be >= 0 and < max height');
  }
  if (!(env.topClearance >= 0)) err('envelope.topClearance', 'Top clearance must be >= 0');

  if (!(cab.panelThickness > 0)) err('cabinet.panelThickness', 'Panel thickness must be > 0');
  if (!(cab.backThickness > 0)) err('cabinet.backThickness', 'Back thickness must be > 0');
  if (!(cab.plinthHeight >= 0)) err('cabinet.plinthHeight', 'Plinth height must be >= 0');
  if (!(cab.gapBack >= 0)) err('cabinet.gapBack', 'Back gap must be >= 0');
  if (!(cab.depth >= 200)) err('cabinet.depth', 'Cabinet depth must be >= 200');
  if (cab.depth + cab.gapBack > env.depth) {
    err('cabinet.depth', `Cabinet depth + back gap (${cab.depth + cab.gapBack}) exceeds envelope depth (${env.depth})`);
  }

  const total = cab.columns.reduce((s, c) => s + c.width, 0);
  if (total > env.length) err('cabinet.columns', `Columns total ${total} exceeds envelope length ${env.length}`);

  const envelopeOk = env.length > 0 && env.heightMin >= 0 && env.heightMax > env.heightMin;
  const t = cab.panelThickness;
  const minWidth = 2 * t + 100;
  const minHeight = cab.plinthHeight + 2 * t + 100;
  let x = 0;
  cab.columns.forEach((c, i) => {
    const path = `cabinet.columns[${i}]`;
    if (!(c.width >= minWidth)) err(`${path}.width`, `Column ${i + 1}: width must be >= ${minWidth}`);
    x += c.width;
    if (envelopeOk) {
      const hLow = ceilY(env, x) - env.topClearance;
      if (hLow < minHeight) {
        err(`${path}.width`, `Column ${i + 1}: low-side height ${Math.round(hLow)} is below minimum ${minHeight}`);
      }
    }
    if (c.front === 'drawers' && !(c.drawerCount >= 1)) err(`${path}.drawerCount`, `Column ${i + 1}: at least 1 drawer`);
    if (!(c.shelves >= 0)) err(`${path}.shelves`, `Column ${i + 1}: shelves must be >= 0`);
  });
  return errors;
}
