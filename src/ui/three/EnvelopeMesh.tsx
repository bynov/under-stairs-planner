import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { Envelope } from '../../model/types';

export function EnvelopeMesh({ envelope: e }: { envelope: Envelope }) {
  const { length: L, heightMax: H, heightMin: h, depth: D } = e;
  const slope = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([0, H, 0, L, h, 0, L, h, D, 0, H, 0, L, h, D, 0, H, D]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, [L, H, h, D]);
  const front: [number, number, number][] = [[0, 0, 0], [L, 0, 0], [L, h, 0], [0, H, 0], [0, 0, 0]];
  const back: [number, number, number][] = [[0, 0, D], [L, 0, D], [L, h, D], [0, H, D], [0, 0, D]];
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
      <Line points={[[0, H, 0], [0, H, D]]} color="#555" lineWidth={1} />
      <Line points={[[L, h, 0], [L, h, D]]} color="#555" lineWidth={1} />
      <Line points={[[L, 0, 0], [L, 0, D]]} color="#555" lineWidth={1} />
    </group>
  );
}
