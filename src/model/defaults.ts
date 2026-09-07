import type { Column, Project } from './types';

let seq = 0;
export function newColumnId(): string {
  seq += 1;
  return `c${Date.now().toString(36)}-${seq}`;
}

export function defaultColumn(width = 500): Column {
  return { id: newColumnId(), width, interior: 'shelves', shelves: 0, drawerCount: 3, door: true, rod: false };
}

export function defaultProject(): Project {
  return {
    name: 'Under-stairs cabinet',
    envelope: { length: 2600, heightMax: 2200, heightMin: 900, depth: 900, tallSide: 'left', topClearance: 20 },
    cabinet: {
      panelThickness: 18,
      backThickness: 4,
      plinthHeight: 100,
      depth: 600,
      gapBack: 20,
      topStyle: 'sloped',
      columns: [
        { ...defaultColumn(700), rod: true },
        { ...defaultColumn(600), shelves: 3 },
        { ...defaultColumn(600), interior: 'drawers', drawerCount: 4, door: false },
        { ...defaultColumn(600), interior: 'drawers', drawerCount: 3, door: true },
      ],
    },
  };
}
