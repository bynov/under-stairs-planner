import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useStore } from '../../store/store';
import { buildParts } from '../../geometry/parts';
import { layoutColumns } from '../../geometry/column';
import { setSnapshotter } from '../snapshot';
import { PartMesh } from './PartMesh';
import { EnvelopeMesh } from './EnvelopeMesh';
import { useT } from '../useT';

function SnapshotBridge() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    setSnapshotter(() => gl.domElement.toDataURL('image/png'));
    return () => setSnapshotter(null);
  }, [gl]);
  return null;
}

function CameraFit({ length, height, depth }: { length: number; height: number; depth: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const r = Math.max(length, height, depth);
    camera.position.set(length / 2 + r * 0.3, height * 0.8, -r * 1.6);
    camera.near = 10;
    camera.far = r * 20;
    camera.lookAt(length / 2, height / 2, depth / 2);
    camera.updateProjectionMatrix();
  }, [camera, length, height, depth]);
  return null;
}

export function Viewport3D() {
  const project = useStore((s) => s.lastValid);
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  const { t } = useT();
  const parts = useMemo(() => buildParts(project), [project]);
  const cols = useMemo(() => layoutColumns(project), [project]);
  const env = project.envelope;
  const mirror = env.tallSide === 'right';
  return (
    <div className="viewport">
      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ fov: 45 }} style={{ background: '#f0f2f5' }}>
        <CameraFit length={env.length} height={env.heightMax} depth={env.depth} />
        <SnapshotBridge />
        <ambientLight intensity={0.7} />
        <directionalLight position={[-1000, 3000, -2000]} intensity={1.2} />
        <directionalLight position={[2000, 1000, 2000]} intensity={0.4} />
        {ui.showEnvelope && <EnvelopeMesh envelope={env} mirror={mirror} />}
        {/* The envelope is rendered outside this mirrored group: a negative-determinant
            scale flips triangle/segment winding, which drei's Line (Line2/LineMaterial,
            single-sided) then culls in screen space, hiding every envelope edge. Instead
            EnvelopeMesh mirrors its own X coordinates when `mirror` is set. */}
        <group scale={[mirror ? -1 : 1, 1, 1]} position={[mirror ? env.length : 0, 0, 0]}>
          {parts.map((p) => <PartMesh key={p.id} part={p} explode={ui.explode} />)}
          {ui.showDims && cols.map((L) => (
            <group key={L.index}>
              <Html position={[(L.x0 + L.x1) / 2, -60, -100]} center><div className="dim3d">{L.width}</div></Html>
              <Html position={[L.x1, L.hLow + 60, -100]} center><div className="dim3d">{Math.round(L.hLow)}</div></Html>
              {L.index === 0 && (
                <Html position={[L.x0, L.hTall + 60, -100]} center><div className="dim3d">{Math.round(L.hTall)}</div></Html>
              )}
            </group>
          ))}
        </group>
        <OrbitControls makeDefault target={[env.length / 2, env.heightMax / 2, env.depth / 2]} />
      </Canvas>
      <div className="controls">
        <label><input type="checkbox" checked={ui.showDims} onChange={(e) => setUi({ showDims: e.target.checked })} /> {t('ui.dims')}</label>
        <label><input type="checkbox" checked={ui.showEnvelope} onChange={(e) => setUi({ showEnvelope: e.target.checked })} /> {t('ui.envelope')}</label>
        <label>{t('ui.explode')} <input type="range" min={0} max={1} step={0.05} value={ui.explode} onChange={(e) => setUi({ explode: e.target.valueAsNumber })} /></label>
      </div>
    </div>
  );
}
