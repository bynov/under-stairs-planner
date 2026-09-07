import type { Column, Envelope, Project } from '../model/types';

export function ceilY(env: Envelope, x: number): number {
  return env.heightMax - ((env.heightMax - env.heightMin) * x) / env.length;
}

export function slopeAngle(env: Envelope): number {
  return Math.atan((env.heightMax - env.heightMin) / env.length);
}

export interface ColumnRange {
  index: number;
  column: Column;
  x0: number;
  x1: number;
  width: number;
  hTall: number; // outer cabinet top height at x0
  hLow: number;  // outer cabinet top height at x1
}

export function columnRanges(p: Project): ColumnRange[] {
  const { envelope: env, cabinet } = p;
  let x = 0;
  return cabinet.columns.map((column, index) => {
    const x0 = x;
    const x1 = x + column.width;
    x = x1;
    return {
      index,
      column,
      x0,
      x1,
      width: column.width,
      hTall: ceilY(env, x0) - env.topClearance,
      hLow: ceilY(env, x1) - env.topClearance,
    };
  });
}
