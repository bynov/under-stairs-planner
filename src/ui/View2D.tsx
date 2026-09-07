import { useMemo } from 'react';
import { useStore } from '../store/store';
import { frontView, planView, sideView } from '../drawing/views';
import { drawingToSvg } from '../render/svg';
import { useT } from './useT';

export function View2D({ tab }: { tab: 'front' | 'plan' | 'side' }) {
  const project = useStore((s) => s.lastValid);
  const { lang } = useT();
  const svg = useMemo(() => {
    const d = tab === 'front' ? frontView(project, lang) : tab === 'plan' ? planView(project, lang) : sideView(project, lang);
    return drawingToSvg(d);
  }, [project, tab, lang]);
  return <div className="view2d" dangerouslySetInnerHTML={{ __html: svg }} />;
}
