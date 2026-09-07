import * as THREE from 'three';
import { BOX_BOTTOM, BOX_PANEL, type DrawerBox } from '../../geometry/drawerBox';

const COLOR = '#e9dcc0';

function Panel({ x0, x1, y0, y1, z0, z1 }: DrawerBox) {
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}>
      <boxGeometry args={[x1 - x0, y1 - y0, z1 - z0]} />
      <meshStandardMaterial color={COLOR} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Placeholder drawer box behind a front: two sides, back, bottom. Explode offset applied by the parent. */
export function DrawerBoxMesh({ box, explode }: { box: DrawerBox; explode: number }) {
  const { x0, x1, y0, y1, z0, z1 } = box;
  return (
    <group position={[0, 0, -300 * explode]}>
      <Panel x0={x0} x1={x0 + BOX_PANEL} y0={y0} y1={y1} z0={z0} z1={z1} />
      <Panel x0={x1 - BOX_PANEL} x1={x1} y0={y0} y1={y1} z0={z0} z1={z1} />
      <Panel x0={x0 + BOX_PANEL} x1={x1 - BOX_PANEL} y0={y0} y1={y1} z0={z1 - BOX_PANEL} z1={z1} />
      <Panel x0={x0 + BOX_PANEL} x1={x1 - BOX_PANEL} y0={y0} y1={y0 + BOX_BOTTOM} z0={z0} z1={z1 - BOX_PANEL} />
    </group>
  );
}
