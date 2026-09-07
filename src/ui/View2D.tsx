import { useMemo } from 'react';
import { useStore } from '../store/store';
import { frontView, planView, sideView } from '../drawing/views';
import { drawingToSvg } from '../render/svg';

export function View2D({ tab }: { tab: 'front' | 'plan' | 'side' }) {
  const project = useStore((s) => s.lastValid);
  const svg = useMemo(() => {
    const d = tab === 'front' ? frontView(project) : tab === 'plan' ? planView(project) : sideView(project);
    return drawingToSvg(d);
  }, [project, tab]);
  return <div className="view2d" dangerouslySetInnerHTML={{ __html: svg }} />;
}
