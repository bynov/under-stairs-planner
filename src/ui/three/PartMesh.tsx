import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Part, PartKind } from '../../geometry/parts';

const COLORS: Record<PartKind, string> = {
  side: '#d9c7a3', top: '#d9c7a3', bottom: '#d9c7a3', shelf: '#e3d5b8', back: '#c9b48e',
  door: '#a9c4d6', drawerFront: '#9fbbd0', plinth: '#8a7a5e', rod: '#8c8c8c',
};

function explodeOffset(kind: PartKind, f: number): THREE.Vector3 {
  const o = new THREE.Vector3();
  switch (kind) {
    case 'door': o.z = -500 * f; break;
    case 'drawerFront': o.z = -300 * f; break;
    case 'top': o.y = 300 * f; break;
    case 'back': o.z = 300 * f; break;
    case 'plinth': o.y = -150 * f; break;
    case 'shelf': o.z = -150 * f; break;
    default: break;
  }
  return o;
}

export function PartMesh({ part, explode }: { part: Part; explode: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    part.outline.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false });
  }, [part.outline, part.thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const matrix = useMemo(() => {
    const { position: p, rotation: r } = part.transform;
    // Must equal toWorld() in geometry/vec.ts — pinned by geometry/matrix.test.ts
    const m = new THREE.Matrix4().makeRotationX(r.x);
    m.premultiply(new THREE.Matrix4().makeRotationY(r.y));
    m.premultiply(new THREE.Matrix4().makeRotationZ(r.z));
    const o = explodeOffset(part.kind, explode);
    m.setPosition(p.x + o.x, p.y + o.y, p.z + o.z);
    return m;
  }, [part, explode]);

  return (
    <mesh geometry={geometry} matrix={matrix} matrixAutoUpdate={false}>
      <meshStandardMaterial color={COLORS[part.kind]} side={THREE.DoubleSide} />
    </mesh>
  );
}
