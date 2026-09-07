import { useEffect } from 'react';
import { useStore } from '../store/store';

export function Toast() {
  const msg = useStore((s) => s.ui.toast);
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => toast(null), 4000);
    return () => clearTimeout(id);
  }, [msg, toast]);
  return msg ? <div className="toast">{msg}</div> : null;
}
