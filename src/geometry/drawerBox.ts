import type { Cabinet } from '../model/types';
import type { ColumnLayout } from './column';

export const RUNNER_CLEARANCE = 13;   // per side, side-mount runners
export const BOX_TOP_CLEARANCE = 20;  // box height = front height - this
export const BOX_BOTTOM_LIFT = 10;    // box bottom above the front's bottom edge
export const BOX_DEPTH_CLEARANCE = 20;
export const BOX_PANEL = 12;          // sides / back thickness (visual only)
export const BOX_BOTTOM = 6;          // bottom thickness (visual only)

/** Absolute mm. Open-top box behind one drawer front; 3D visualisation only (not a Part). */
export interface DrawerBox { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

export function drawerBoxes(L: ColumnLayout, cab: Cabinet): DrawerBox[] {
  const t = cab.panelThickness, plinth = cab.plinthHeight;
  const zFront = L.drawerStyle === 'internal' ? t : 0;
  const x0 = L.x0 + t + RUNNER_CLEARANCE;
  const x1 = L.x1 - t - RUNNER_CLEARANCE;
  const z1 = L.interiorDepth - BOX_DEPTH_CLEARANCE;
  return L.drawerFronts.map((d) => ({
    x0, x1,
    y0: plinth + d.y0 + BOX_BOTTOM_LIFT,
    y1: plinth + d.y1 - (BOX_TOP_CLEARANCE - BOX_BOTTOM_LIFT),
    z0: zFront, z1,
  }));
}
