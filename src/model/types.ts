export type TallSide = 'left' | 'right';
export type TopStyle = 'sloped' | 'stepped';
export type FrontKind = 'none' | 'door' | 'drawers';

export interface Envelope {
  length: number;      // along X
  heightMax: number;   // ceiling height at x = 0
  heightMin: number;   // ceiling height at x = length; may be 0
  depth: number;       // along Z
  tallSide: TallSide;  // display mirroring only
  topClearance: number;
}

export interface Column {
  id: string;
  width: number;
  front: FrontKind;
  shelves: number;
  drawerCount: number;
  rod: boolean;
}

export interface Cabinet {
  panelThickness: number;
  backThickness: number;
  plinthHeight: number;
  depth: number;
  gapBack: number; // minimum gap between cabinet back and back wall (validation only)
  topStyle: TopStyle;
  columns: Column[];
}

export interface Project {
  name: string;
  envelope: Envelope;
  cabinet: Cabinet;
}

export interface ValidationError {
  path: string;
  message: string;
}
