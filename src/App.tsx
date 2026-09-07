import { useEffect } from 'react';
import { useStore } from './store/store';
import { TopBar } from './ui/TopBar';
import { Sidebar } from './ui/Sidebar';
import { Toast } from './ui/Toast';
import { View2D } from './ui/View2D';
import { CutListTable } from './ui/CutListTable';
import { Viewport3D } from './ui/three/Viewport3D';

export function App() {
  const tab = useStore((s) => s.ui.tab);
  const lang = useStore((s) => s.ui.lang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <Sidebar />
        <main className="content">
          {tab === '3d' && <Viewport3D />}
          {(tab === 'front' || tab === 'plan' || tab === 'side') && <View2D tab={tab} />}
          {tab === 'cutlist' && <CutListTable />}
        </main>
      </div>
      <Toast />
    </div>
  );
}
