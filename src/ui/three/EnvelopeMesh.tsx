import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { Envelope } from '../../model/types';

export function EnvelopeMesh({ envelope: e, mirror = false }: { envelope: Envelope; mirror?: boolean }) {
  const { length: L, heightMax: H, heightMin: h, depth: D } = e;
  const mx = (x: number) => (mirror ? L - x : x);
  const slope = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const x0 = mx(0), x1 = mx(L);
    const v = new Float32Array([x0, H, 0, x1, h, 0, x1, h, D, x0, H, 0, x1, h, D, x0, H, D]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, [L, H, h, D, mirror]);
  const front: [number, number, number][] = [[mx(0), 0, 0], [mx(L), 0, 0], [mx(L), h, 0], [mx(0), H, 0], [mx(0), 0, 0]];
  const back: [number, number, number][] = [[mx(0), 0, D], [mx(L), 0, D], [mx(L), h, D], [mx(0), H, D], [mx(0), 0, D]];
  return (
    <group>
      <mesh geometry={slope}>
        <meshStandardMaterial color="#7fa7d1" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, -1, D / 2]}>
        <planeGeometry args={[L, D]} />
        <meshStandardMaterial color="#e2e2e2" side={THREE.DoubleSide} />
      </mesh>
      <Line points={front} color="#555" lineWidth={1} />
      <Line points={back} color="#555" lineWidth={1} dashed dashSize={40} gapSize={25} />
      <Line points={[[mx(0), H, 0], [mx(0), H, D]]} color="#555" lineWidth={1} />
      <Line points={[[mx(L), h, 0], [mx(L), h, D]]} color="#555" lineWidth={1} />
      <Line points={[[mx(L), 0, 0], [mx(L), 0, D]]} color="#555" lineWidth={1} />
    </group>
  );
}
